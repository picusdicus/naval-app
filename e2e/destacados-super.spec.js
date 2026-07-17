import { test, expect } from '@playwright/test'
import { BASE_URL, exigir } from './entorno.js'

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

async function iniciarSesionSuper(page) {
  await page.goto('/admin')
  await page.fill('input[type="email"]', exigir('SUPER_ADMIN_EMAIL'))
  await page.fill('input[type="password"]', exigir('SUPER_ADMIN_PASSWORD'))
  await page.click('button[type="submit"]')
  await page.waitForURL('/admin')
}

test.afterAll(async ({ playwright }) => {
  if (creados.length === 0) return

  const contexto = await playwright.request.newContext({ baseURL: BASE_URL })
  await contexto.post('/api/admin/login', {
    data: { email: exigir('SUPER_ADMIN_EMAIL'), password: exigir('SUPER_ADMIN_PASSWORD') },
  })
  for (const id of creados) {
    await contexto.delete(`/api/super/destacados?id=${id}`)
  }
  await contexto.dispose()
  creados.length = 0
})

test('crear un destacado sin duración se rechaza con 400', async ({ page }) => {
  await iniciarSesionSuper(page)

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

test('un activo próximo a caducar muestra el aviso en la tabla', async ({ page }, info) => {
  await iniciarSesionSuper(page)

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
