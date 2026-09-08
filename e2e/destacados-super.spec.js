import { test, expect } from '@playwright/test'
import { BASE_URL, SESION_SUPER } from './entorno.js'

// Pestaña Destacados del superadmin: la duración es obligatoria al crear y el
// aviso de caducidad próxima aparece en la columna Vigencia. El destacado se
// crea por API con una referencia sintética única por run (el UNIQUE
// (tipo, referencia_id) hace upsert, así no se pisa ninguna fila real); la
// tabla lo lista igualmente («Referencia no encontrada») y aunque el GET
// público lo sirva, useDestacados lo filtra en silencio en las páginas.

// ISO en zona local, como calculan las superficies el aviso (src/lib/fechas.js).
const isoLocal = (desplazamientoDias) => {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + desplazamientoDias)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

const creados = []

test.describe.configure({ mode: 'serial' })

// La sesión de superadmin llega del proyecto `setup` (e2e/sesion.setup.js):
// el login está limitado a 5 intentos cada 15 minutos y hacerlo por test
// agotaba el cupo a mitad de suite.
test.use({ storageState: SESION_SUPER })

test.afterAll(async ({ playwright }) => {
  if (creados.length === 0) return

  // Reutiliza la cookie del setup en vez de gastar otro login para limpiar.
  const contexto = await playwright.request.newContext({
    baseURL: BASE_URL,
    storageState: SESION_SUPER,
  })
  for (const id of creados) {
    await contexto.delete(`/api/super/destacados?id=${id}`)
  }
  await contexto.dispose()
  creados.length = 0
})

test('crear un destacado sin duración se rechaza con 400', async ({ page }) => {
  // Solo API: page.request comparte el tarro de cookies del contexto, que ya
  // nace autenticado por el storageState.
  const respuesta = await page.request.post('/api/super/destacados', {
    data: {
      tipo: 'evento',
      referenciaId: `bd-e2e-sin-duracion-${Date.now()}`,
      estado: 'activo',
      fechaInicio: isoLocal(0),
      // sin fechaFin: la duración es obligatoria desde el superadmin
    },
  })
  expect(respuesta.status()).toBe(400)
  const { error } = await respuesta.json()
  expect(error).toContain('duración')
})

test('una solicitud pendiente cuenta en el tab y su vigencia se marca como propuesta', async ({ page }, info) => {
  const respuesta = await page.request.post('/api/super/destacados', {
    data: {
      tipo: 'evento',
      referenciaId: `bd-e2e-propuesta-${info.project.name}-${Date.now()}`,
      estado: 'pendiente',
      fechaInicio: isoLocal(1),
      fechaFin: isoLocal(30),
    },
  })
  expect(respuesta.status()).toBe(201)
  const { destacado } = await respuesta.json()
  creados.push(destacado.id)

  await page.goto('/admin')

  // El tab Destacados muestra el nº de pendientes (al menos el recién creado).
  // El contador llega en un fetch propio del panel: el filtro numérico hace
  // que toBeVisible espere a que se pinte (el otro span del botón es el icono).
  const tabDestacados = page.locator('button').filter({ hasText: 'Destacados' })
  const contador = tabDestacados.locator('span').filter({ hasText: /^\d+$/ })
  await expect(contador).toBeVisible()
  expect(Number(await contador.textContent())).toBeGreaterThanOrEqual(1)

  // En la tabla, las fechas de un pendiente se marcan como propuesta de la org.
  await tabDestacados.click()
  const fila = page.locator('tr').filter({ hasText: isoLocal(30) })
  await expect(fila.first().getByText('propuesta')).toBeVisible()
})

test('un activo próximo a caducar muestra el aviso en la tabla', async ({ page }, info) => {
  // fecha_inicio de ayer: CURRENT_DATE en Neon va en UTC y alrededor de
  // medianoche podría ir un día por detrás de la zona local; con ayer la fila
  // es vigente en ambos relojes. El aviso se calcula en cliente sobre fecha_fin.
  const respuesta = await page.request.post('/api/super/destacados', {
    data: {
      tipo: 'evento',
      referenciaId: `bd-e2e-caducidad-${info.project.name}-${Date.now()}`,
      estado: 'activo',
      fechaInicio: isoLocal(-1),
      fechaFin: isoLocal(3),
    },
  })
  expect(respuesta.status()).toBe(201)
  const { destacado } = await respuesta.json()
  creados.push(destacado.id)
  expect(destacado.vigente).toBe(true)

  await page.goto('/admin')
  await page.locator('button:has-text("Destacados")').click()

  // La fila sintética muestra la vigencia y el aviso aunque la referencia
  // no resuelva a ningún evento real.
  const fila = page.locator('tr').filter({ hasText: isoLocal(3) })
  await expect(fila.first().getByText('caduca en 3 días')).toBeVisible()
})
