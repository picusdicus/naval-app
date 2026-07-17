import { test, expect } from '@playwright/test'
import { BASE_URL, exigir } from './entorno.js'

// Autoservicio de destacados: la organización solicita destacar un evento
// publicado desde /panel, proponiendo fecha de inicio y duración en un
// diálogo. La solicitud nace en 'pendiente' con la propuesta (el orden y la
// decisión final son del superadmin) y puede retirarse mientras nadie la
// gestione. El flujo de comercio no se cubre aquí: depende de que el
// superadmin vincule `comercio_id`, otra sesión.

// Con fecha futura el botón «Destacar» está disponible (publicado + no pasado).
const FUTURO = (() => {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 30)
  return fecha.toISOString().slice(0, 10)
})()

const creados = []

test.describe.configure({ mode: 'serial' })

async function iniciarSesionAdmin(page) {
  await page.goto('/login')
  await page.locator('#email').fill(exigir('ADMIN_EMAIL'))
  await page.locator('#password').fill(exigir('ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Acceder' }).click()
  await expect(page).toHaveURL(/\/panel$/)
}

test.afterAll(async ({ playwright }) => {
  if (creados.length === 0) return

  const contexto = await playwright.request.newContext({ baseURL: BASE_URL })
  await contexto.post('/api/login', {
    data: { email: exigir('ADMIN_EMAIL'), password: exigir('ADMIN_PASSWORD') },
  })
  // Si el test falló a medias puede quedar una solicitud pendiente: retirarla
  // antes de borrar el evento, para no dejar referencias muertas en Neon.
  const respuesta = await contexto.get('/api/admin/destacados')
  const { destacados = [] } = await respuesta.json().catch(() => ({}))
  for (const id of creados) {
    const solicitud = destacados.find((d) => d.referenciaId === `bd-${id}` && d.estado === 'pendiente')
    if (solicitud) await contexto.delete(`/api/admin/destacados?id=${solicitud.id}`)
    await contexto.delete(`/api/admin/eventos?id=${id}`)
  }
  await contexto.dispose()
  creados.length = 0
})

test('solicitar y retirar el destacado de un evento desde el panel', async ({ page }, info) => {
  await iniciarSesionAdmin(page)

  const titulo = `Prueba e2e · Destacar · ${info.project.name}`
  const respuesta = await page.request.post('/api/admin/eventos', {
    data: {
      titulo,
      descripcion: 'Evento temporal para probar la solicitud de destacado.',
      categoria: 'cultura',
      lugar: 'Teatro TYL TYL',
      fecha: FUTURO,
      hora: '19:00',
      estado: 'publicado',
    },
  })
  expect(respuesta.status()).toBe(201)

  const lista = await page.request.get('/api/admin/eventos')
  const { eventos } = await lista.json()
  const evento = eventos.find((e) => e.titulo === titulo)
  creados.push(evento.id)

  await page.goto('/panel')
  const fila = page.locator('li').filter({ hasText: titulo })

  // Publicado y futuro: el botón abre el diálogo de propuesta de fechas; los
  // valores por defecto (hoy + 30 días) valen para el test.
  await fila.getByRole('button', { name: 'Destacar', exact: true }).click()
  await page.getByRole('button', { name: 'Solicitar destacado' }).click()
  await expect(fila.getByText('Destacado solicitado')).toBeVisible()

  // La solicitud existe en la API en estado pendiente y lleva la propuesta de
  // vigencia (fecha_fin la calculó el servidor a partir de la duración).
  const propios = await page.request.get('/api/admin/destacados')
  const { destacados } = await propios.json()
  const solicitud = destacados.find((d) => d.referenciaId === `bd-${evento.id}`)
  expect(solicitud?.estado).toBe('pendiente')
  expect(solicitud?.fechaInicio).toBeTruthy()
  expect(solicitud?.fechaFin).toBeTruthy()

  // Retirarla devuelve la fila a su estado original.
  await fila.getByRole('button', { name: 'Retirar solicitud' }).click()
  await expect(fila.getByText('Destacado solicitado')).toHaveCount(0)
  await expect(fila.getByRole('button', { name: 'Destacar', exact: true })).toBeVisible()
})
