// Camino "deportes nuevos a revisión" (feat/deportes-nuevos-a-revision):
// hoy NO existe ningún cartel real que lo ejercite (los 36 de la galería están
// todos en la lista de exclusión), así que este spec lo cubre con un cartel
// SINTÉTICO que simula una temporada futura: id que no está en la lista y que
// no empareja con el programa. Sin este spec, la primera prueba real del
// camino sería el primer cartel de verdad sin emparejar, en producción.
//
// Como toda la suite, sin mocks: clasifica con la función real, upserta contra
// el Neon real (misma función que llama el cron) y valida el ciclo humano en
// la bandeja Pendientes de /admin. Limpia su fila sintética al terminar.
import { test, expect } from '@playwright/test'
import { exigir } from './entorno.js'
import { obtenerSql } from '../api/_db.js'
import {
  separarDeportesParaRevision,
  upsertDeportesEnRevision,
} from '../api/_deportes-revision.js'
import { DEPORTES_GRANDFATHERED } from '../api/_datos/deportes-grandfathered.js'

const ID_SINTETICO = 'deportes-99-torneo-sintetico-e2e'
const TITULO = 'Torneo sintético e2e (temporada futura)'

function fechaFutura(dias) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

// La forma exacta que emite el parser del feed para un cartel sin emparejar.
const cartelSintetico = {
  titulo: TITULO,
  fecha_evento: fechaFutura(30),
  imagen: 'https://navalcarnero.es/e2e/torneo-sintetico.jpg',
  url_fuente: 'https://navalcarnero.es/e2e/torneo-sintetico/',
  origen_externo_id: ID_SINTETICO,
  categoria: 'deporte',
}

async function loginSuperadmin(page) {
  await page.goto('/admin')
  await page.fill('input[type="email"]', exigir('SUPER_ADMIN_EMAIL'))
  await page.fill('input[type="password"]', exigir('SUPER_ADMIN_PASSWORD'))
  await page.click('button[type="submit"]')
  await page.waitForURL('/admin')
}

async function filaSintetica(sql) {
  return sql`
    SELECT origen_externo_id, titulo, categoria, estado, lugar, imagen_url, url_fuente,
           to_char(fecha_evento, 'YYYY-MM-DD') AS fecha_evento
    FROM actividades WHERE origen_externo_id = ${ID_SINTETICO}`
}

test.describe.serial('Deportes: carteles nuevos a revisión', () => {
  let sql

  test.beforeAll(async () => {
    sql = obtenerSql()
    await sql`DELETE FROM actividades WHERE origen_externo_id = ${ID_SINTETICO}`
  })

  test.afterAll(async () => {
    await sql`DELETE FROM actividades WHERE origen_externo_id = ${ID_SINTETICO}`
  })

  test('la clasificación separa nuevo / grandfathered / emparejado', () => {
    const idGrandfathered = [...DEPORTES_GRANDFATHERED][0]
    const grandfathered = { ...cartelSintetico, origen_externo_id: idGrandfathered }
    const emparejado = {
      ...cartelSintetico,
      origen_externo_id: 'deportes-98-otro-sintetico',
      enriqueceEvento: 'fiestas-lo-que-sea-2026-09-01',
    }
    const { paraJson, paraRevision } = separarDeportesParaRevision([
      cartelSintetico,
      grandfathered,
      emparejado,
    ])
    expect(paraRevision.map((a) => a.origen_externo_id)).toEqual([ID_SINTETICO])
    expect(paraJson.map((a) => a.origen_externo_id)).toEqual([
      idGrandfathered,
      'deportes-98-otro-sintetico',
    ])
  })

  test('el upsert crea el borrador y el re-run actualiza sin duplicar ni tocar estado', async () => {
    const primero = await upsertDeportesEnRevision(sql, [cartelSintetico])
    expect(primero).toMatchObject({ creadas: 1, actualizadas: 0, errores: [] })

    let filas = await filaSintetica(sql)
    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({
      estado: 'borrador',
      categoria: 'deporte',
      lugar: 'Navalcarnero',
      titulo: TITULO,
      fecha_evento: cartelSintetico.fecha_evento,
      imagen_url: cartelSintetico.imagen,
      url_fuente: cartelSintetico.url_fuente,
    })

    // Re-run del cron simulado: mismo id, título retocado (re-scrape).
    const segundo = await upsertDeportesEnRevision(sql, [
      { ...cartelSintetico, titulo: `${TITULO} v2` },
    ])
    expect(segundo).toMatchObject({ creadas: 0, actualizadas: 1, errores: [] })

    filas = await filaSintetica(sql)
    expect(filas).toHaveLength(1)
    expect(filas[0].estado).toBe('borrador')
    expect(filas[0].titulo).toBe(`${TITULO} v2`)
  })

  test('aparece en Pendientes, descartarlo archiva y el re-run no lo resucita', async ({ page }) => {
    await loginSuperadmin(page)
    await page.click('button:has-text("Pendientes")')

    const titulo = page.getByText(`${TITULO} v2`)
    await expect(titulo).toBeVisible()

    // La fila es el abuelo del <p> del título (ver Fila en TablesPendientes).
    await titulo.locator('xpath=../..').getByRole('button', { name: 'Descartar' }).click()
    await expect(titulo).toHaveCount(0)

    await expect
      .poll(async () => (await filaSintetica(sql))[0]?.estado)
      .toBe('archivado')

    // Re-run: el upsert no debe tocar el estado.
    await upsertDeportesEnRevision(sql, [{ ...cartelSintetico, titulo: `${TITULO} v2` }])
    const filas = await filaSintetica(sql)
    expect(filas).toHaveLength(1)
    expect(filas[0].estado).toBe('archivado')
  })

  test('publicado tampoco se resetea y la actividad sale en la agenda', async ({ page }) => {
    // Publicación (equivale al botón "Publicar" de Pendientes, ya cubierto por
    // el PATCH del endpoint; aquí interesa la interacción con el re-run).
    await sql`
      UPDATE actividades SET estado = 'publicado', publicado_en = now()
      WHERE origen_externo_id = ${ID_SINTETICO}`

    await upsertDeportesEnRevision(sql, [{ ...cartelSintetico, titulo: `${TITULO} v2` }])
    const filas = await filaSintetica(sql)
    expect(filas[0].estado).toBe('publicado')

    // Visible en el endpoint público de actividades…
    const res = await page.request.get('/api/actividades')
    expect(res.ok()).toBeTruthy()
    const { actividades } = await res.json()
    expect(actividades.some((a) => a.origen_externo_id === ID_SINTETICO)).toBe(true)

    // …y como tarjeta en la agenda (useEventosPublicos mapea actividades con
    // fecha_evento a eventos de su categoría real).
    await page.goto('/eventos')
    await expect(page.getByText(`${TITULO} v2`).first()).toBeVisible()
  })
})
