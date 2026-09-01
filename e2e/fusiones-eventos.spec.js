import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'
import { test, expect } from '@playwright/test'
import { RAIZ, exigir } from './entorno.js'

// Fusión manual de eventos (issue #27): el superadmin une dos entradas que el
// matcher automático no reconoce como el mismo acto. Este spec ataca el dev
// server real y la tabla `fusiones_eventos` de Neon de verdad: fusiona dos
// eventos estáticos futuros reales, comprueba la fila en Neon, la tarjeta
// única en la agenda pública, el deep link del id secundario, el deshacer, y
// el caso de fusión inerte (una de las partes ya no viene de las fuentes).
// Todo va en UN solo test por proyecto para hacer un único login (el
// rate-limit de /api/admin/login es 5/15min por IP+email con Upstash en .env).

const REF_INEXISTENTE = 'e2e-fusion-parte-inexistente'

// Dos eventos estáticos futuros reales, con título único en todo el JSON y en
// fechas DISTINTAS (misma fecha + títulos equivalentes los fusionaría el
// matcher automático y el test no probaría nada).
function eventosDePrueba() {
  const curados = JSON.parse(readFileSync(resolve(RAIZ, 'src/data/eventos.json'), 'utf8'))
  const externos = JSON.parse(readFileSync(resolve(RAIZ, 'src/data/eventos-externos.json'), 'utf8'))
  const todos = [...curados, ...externos]
  const hoy = new Date().toISOString().slice(0, 10)

  // El buscador del panel filtra por `includes` sobre título Y lugar, así que
  // no basta con que el título sea único: no puede estar CONTENIDO en ningún
  // otro título ni lugar ("Fiestas patronales" aparece dentro de una docena).
  const soloUnaCoincidencia = (titulo) => {
    const t = titulo.toLowerCase()
    return (
      todos.filter(
        (x) =>
          String(x.titulo || '').toLowerCase().includes(t) ||
          String(x.lugar || '').toLowerCase().includes(t),
      ).length === 1
    )
  }

  const candidatos = todos.filter(
    (e) =>
      e.id &&
      e.titulo &&
      e.titulo.length >= 12 &&
      e.fecha &&
      e.fecha > hoy &&
      !e.enriqueceEvento &&
      soloUnaCoincidencia(e.titulo),
  )
  const principal = candidatos[0]
  const secundaria = candidatos.find(
    (e) =>
      e.fecha !== principal.fecha &&
      !e.titulo.toLowerCase().includes(principal.titulo.toLowerCase()) &&
      !principal.titulo.toLowerCase().includes(e.titulo.toLowerCase()),
  )
  if (!principal || !secundaria) {
    throw new Error('No hay dos eventos futuros de título único en los JSON para el test de fusiones.')
  }
  return { principal, secundaria }
}

const sql = neon(exigir('DATABASE_URL'))
const { principal, secundaria } = eventosDePrueba()

async function limpiar() {
  await sql`
    CREATE TABLE IF NOT EXISTS fusiones_eventos (
      referencia_secundaria text PRIMARY KEY,
      referencia_principal  text NOT NULL,
      creado_en             timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT fusion_no_reflexiva CHECK (referencia_secundaria <> referencia_principal)
    )
  `
  await sql`
    DELETE FROM fusiones_eventos
    WHERE referencia_secundaria = ANY(${[secundaria.id, REF_INEXISTENTE]})
       OR referencia_principal = ${principal.id}
  `
}

test.describe('Fusiones manuales de eventos', () => {
  test.beforeAll(limpiar)
  test.afterAll(limpiar)

  test('fusionar, persistir en Neon, deep link, deshacer y fusión inerte', async ({ page }) => {
    // Sin caché HTTP del navegador: /api/fusiones-eventos lleva
    // stale-while-revalidate y Chromium re-serviría la lista vacía de la
    // visita base tras fusionar (comportamiento aceptado para visitantes —
    // <1 min de retardo, como eventos-ocultos — pero no determinista aquí).
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })

    // — Estado base de la agenda pública: las dos tarjetas por separado.
    await page.goto('/eventos')
    await expect(page.getByText(principal.titulo).filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByText(secundaria.titulo).filter({ visible: true }).first()).toBeVisible()

    // — Login del superadmin y tab Eventos.
    await page.goto('/admin')
    await page.fill('input[type="email"]', exigir('SUPER_ADMIN_EMAIL'))
    await page.fill('input[type="password"]', exigir('SUPER_ADMIN_PASSWORD'))
    await page.click('button[type="submit"]')
    await page.waitForURL('/admin')
    await page.getByRole('button', { name: 'Eventos', exact: true }).click()

    const buscador = page.getByPlaceholder('Busca por título o lugar…')
    const filas = page.locator('div.divide-y > div')

    // — Primer clic: "Fusionar" en la fila que sobrevive (el principal).
    await buscador.fill(principal.titulo)
    await expect(filas).toHaveCount(1)
    await filas.first().getByRole('button', { name: 'Fusionar', exact: true }).click()
    await expect(page.getByText('Fusionando: elige el evento duplicado')).toBeVisible()

    // — Segundo clic: "Fusionar aquí" en el duplicado.
    await buscador.fill(secundaria.titulo)
    await expect(filas).toHaveCount(1)
    await filas.first().getByRole('button', { name: 'Fusionar aquí' }).click()

    // La tarjeta secundaria desaparece del listado al instante (el panel lee
    // /api/super/fusiones y actualiza estado local — sin esperar la cache de
    // 60 s del GET público).
    await expect(page.getByText('No hay eventos que coincidan con el filtro.')).toBeVisible()
    await buscador.fill(principal.titulo)
    await expect(filas).toHaveCount(1)
    await expect(filas.first().getByText('· fusión manual')).toBeVisible()

    // — La fila existe en Neon con el par correcto.
    const enNeon = await sql`
      SELECT referencia_principal FROM fusiones_eventos WHERE referencia_secundaria = ${secundaria.id}
    `
    expect(enNeon).toHaveLength(1)
    expect(enNeon[0].referencia_principal).toBe(principal.id)

    // — Agenda pública: una sola tarjeta (la principal); la secundaria ya no.
    // Con reintento y recarga: la escritura recién hecha en Neon puede tardar
    // un instante en verse desde otra conexión HTTP del dev server (y en
    // producción la ventana aceptada es además la cache CDN de 60 s).
    await expect(async () => {
      await page.goto('/eventos')
      await expect(page.getByText(principal.titulo).filter({ visible: true }).first()).toBeVisible({ timeout: 3000 })
      await expect(page.getByText(secundaria.titulo)).toHaveCount(0, { timeout: 1000 })
    }).toPass({ timeout: 30_000 })

    // — Deep link del id secundario: resuelve a la ficha del evento fusionado.
    await expect(async () => {
      await page.goto(`/eventos/${encodeURIComponent(secundaria.id)}`)
      await expect(page.getByText(principal.titulo).filter({ visible: true }).first()).toBeVisible({ timeout: 3000 })
    }).toPass({ timeout: 30_000 })

    // — Deshacer desde el detalle desplegable del panel.
    await page.goto('/admin')
    await page.getByRole('button', { name: 'Eventos', exact: true }).click()
    await buscador.fill(principal.titulo)
    await expect(filas).toHaveCount(1)
    await filas.first().locator('button[aria-expanded]').click()
    await expect(page.getByText(`Absorbe «${secundaria.id}»`)).toBeVisible()
    await page.getByRole('button', { name: 'Deshacer' }).click()
    await expect(page.getByText(`Absorbe «${secundaria.id}»`)).toHaveCount(0)

    // Las dos tarjetas vuelven a estar separadas, y la fila de Neon ya no está.
    await buscador.fill(secundaria.titulo)
    await expect(filas).toHaveCount(1)
    expect(await sql`SELECT 1 FROM fusiones_eventos WHERE referencia_secundaria = ${secundaria.id}`).toHaveLength(0)
    await expect(async () => {
      await page.goto('/eventos')
      await expect(page.getByText(secundaria.titulo).filter({ visible: true }).first()).toBeVisible({ timeout: 3000 })
    }).toPass({ timeout: 30_000 })

    // — Fusión inerte: la secundaria ya no existe en ninguna fuente (simula
    // que el cron dejó de traerla). Se crea por la API con la sesión del
    // navegador; la agenda no se rompe y el panel avisa en el detalle.
    const respuesta = await page.request.post('/api/super/fusiones', {
      data: { referenciaPrincipal: principal.id, referenciaSecundaria: REF_INEXISTENTE },
    })
    expect(respuesta.ok()).toBeTruthy()

    await page.goto('/eventos')
    await expect(page.getByText(principal.titulo).filter({ visible: true }).first()).toBeVisible() // agenda intacta

    await page.goto('/admin')
    await page.getByRole('button', { name: 'Eventos', exact: true }).click()
    await buscador.fill(principal.titulo)
    await expect(filas).toHaveCount(1)
    await expect(filas.first().getByText('· fusión sin efecto')).toBeVisible()
    await filas.first().locator('button[aria-expanded]').click()
    await expect(page.getByText('Fusión sin efecto — no se encuentra el secundario')).toBeVisible()
    await page.getByRole('button', { name: 'Deshacer' }).click()
    await expect(page.getByText('· fusión sin efecto')).toHaveCount(0)
    expect(
      await sql`SELECT 1 FROM fusiones_eventos WHERE referencia_secundaria = ${REF_INEXISTENTE}`,
    ).toHaveLength(0)
  })
})
