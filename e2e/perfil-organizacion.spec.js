import { test, expect } from '@playwright/test'
import { BASE_URL, exigir } from './entorno.js'

// La categoría y el lugar de un evento salen del perfil de la organización
// (organizaciones.categoria_defecto / lugar_defecto): el gestor los ve, no los
// elige, y el servidor los impone aunque la petición diga otra cosa.

const PERFIL = { categoria: 'cultura', categoriaVisible: 'Cultura', lugar: 'Teatro TYL TYL' }

// La portada solo muestra los 6 eventos más próximos. Datándolo hoy nos
// aseguramos de que entre, sin depender de cuántos eventos traiga el JSON.
const HOY = new Date().toISOString().slice(0, 10)

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
  for (const id of creados) await contexto.delete(`/api/admin/eventos?id=${id}`)
  await contexto.dispose()
  creados.length = 0
})

test('el formulario muestra categoría y lugar del perfil, y no deja modificarlos', async ({
  page,
}) => {
  await iniciarSesionAdmin(page)
  await page.goto('/panel/eventos/nuevo')

  const categoria = page.locator('#categoria')
  const lugar = page.locator('#lugar')

  await expect(categoria).toHaveValue(PERFIL.categoriaVisible)
  await expect(lugar).toHaveValue(PERFIL.lugar)

  await expect(categoria).toHaveAttribute('readonly', '')
  await expect(lugar).toHaveAttribute('readonly', '')

  // No basta con el atributo: el usuario no debe poder escribir en ellos.
  expect(await categoria.isEditable(), 'la categoría no debe ser editable').toBe(false)
  expect(await lugar.isEditable(), 'el lugar no debe ser editable').toBe(false)

  await lugar.click()
  await page.keyboard.type('Mi casa')
  await expect(lugar).toHaveValue(PERFIL.lugar)
})

test('el servidor ignora la categoría y el lugar que mande el cliente', async ({ page }, info) => {
  await iniciarSesionAdmin(page)

  const titulo = `Prueba e2e · Perfil · ${info.project.name}`
  const respuesta = await page.request.post('/api/admin/eventos', {
    data: {
      titulo,
      descripcion: 'El cliente intenta colar otra categoría y otro lugar.',
      categoria: 'deporte',
      lugar: 'Estadio inventado',
      fecha: HOY,
      hora: '08:00',
      estado: 'publicado',
    },
  })
  expect(respuesta.status()).toBe(201)

  const lista = await page.request.get('/api/admin/eventos')
  const { eventos } = await lista.json()
  const guardado = eventos.find((e) => e.titulo === titulo)
  creados.push(guardado.id)

  expect(guardado.categoria, 'la categoría la fija el perfil').toBe(PERFIL.categoria)
  expect(guardado.lugar, 'el lugar lo fija el perfil').toBe(PERFIL.lugar)
})

test('el detalle público enlaza el lugar a Google Maps y la portada lista el evento', async ({
  page,
}, info) => {
  const titulo = `Prueba e2e · Perfil · ${info.project.name}`
  await page.addInitScript(() => localStorage.setItem('ncv_access', 'true'))

  const publicos = await page.request.get('/api/eventos')
  const { eventos } = await publicos.json()
  const publicado = eventos.find((e) => e.titulo === titulo)
  expect(publicado, 'el evento del test anterior debe estar publicado').toBeTruthy()

  await page.goto(`/eventos/${publicado.id}`)

  const enlaceLugar = page.getByRole('link', { name: new RegExp(PERFIL.lugar) })
  await expect(enlaceLugar).toBeVisible()

  const href = await enlaceLugar.getAttribute('href')
  expect(href).toContain('google.com/maps/search/')
  expect(decodeURIComponent(href)).toContain(`${PERFIL.lugar}, Navalcarnero`)
  await expect(enlaceLugar).toHaveAttribute('target', '_blank')

  // La portada combina las tres fuentes: este evento vive en Neon.
  await page.goto('/')
  await expect(page.getByRole('link', { name: new RegExp(titulo) })).toBeVisible()
})
