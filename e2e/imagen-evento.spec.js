import { resolve } from 'node:path'
import { test, expect } from '@playwright/test'
import { del } from '@vercel/blob'
import { RAIZ, BASE_URL, DOMINIO_BLOB, exigir } from './entorno.js'

// Recorrido completo del cartel de un evento: se elige en el formulario, sube a
// Vercel Blob, su URL queda en eventos_usuario y la imagen se ve en el panel de
// /admin y en la agenda pública. Se ejerce tanto al crear como al editar.
//
// No hay mocks: esto habla con el Neon y el store de Blob de verdad.

const POSTER = resolve(RAIZ, 'public/poster.jpg')

const EVENTO = {
  descripcion: 'Evento creado por los tests de Playwright para verificar la subida de imágenes.',
  categoria: 'cultura',
  lugar: 'Teatro TYL TYL',
  fecha: '2027-03-14',
  hora: '19:30',
}

// Escritorio y móvil corren el mismo fichero: si compartieran título, cada uno
// encontraría el evento del otro al buscarlo por nombre.
const tituloDe = (info) => `Prueba e2e · Cartel · ${info.project.name}`

// Lo que haya que limpiar al terminar, pase lo que pase con los tests.
const creados = { eventos: [], blobs: [] }

test.describe.configure({ mode: 'serial' })

async function iniciarSesionAdmin(page) {
  await page.goto('/admin/login')
  await page.locator('#email').fill(exigir('ADMIN_EMAIL'))
  await page.locator('#password').fill(exigir('ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Acceder' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

/** Sube public/poster.jpg y devuelve la URL que ha devuelto Vercel Blob. */
async function subirCartel(page) {
  await page.locator('input[type=file]').setInputFiles(POSTER)

  const vistaPrevia = page.getByAltText('Cartel del evento')
  await expect(vistaPrevia).toBeVisible()

  const url = await vistaPrevia.getAttribute('src')
  expect(url, 'la vista previa debe apuntar a Vercel Blob').toMatch(DOMINIO_BLOB)
  creados.blobs.push(url)
  return url
}

/** Comprueba que el navegador ha descargado la imagen de verdad, no un 404. */
async function imagenSeCarga(localizador) {
  await expect(localizador).toBeVisible()
  const ancho = await localizador.evaluate((img) => img.naturalWidth)
  expect(ancho, 'la imagen debe cargarse (naturalWidth > 0)').toBeGreaterThan(0)
}

/** Lee el evento desde la API del panel, que consulta Neon. */
async function eventoEnLaBaseDeDatos(page, titulo) {
  const respuesta = await page.request.get('/api/admin/eventos')
  expect(respuesta.ok()).toBeTruthy()
  const { eventos } = await respuesta.json()
  return eventos.find((e) => e.titulo === titulo)
}

test.afterAll(async ({ playwright }) => {
  if (creados.eventos.length > 0) {
    const contexto = await playwright.request.newContext({ baseURL: BASE_URL })
    await contexto.post('/api/admin/login', {
      data: { email: exigir('ADMIN_EMAIL'), password: exigir('ADMIN_PASSWORD') },
    })
    for (const id of creados.eventos) await contexto.delete(`/api/admin/eventos?id=${id}`)
    await contexto.dispose()
    creados.eventos.length = 0
  }

  // Y los blobs subidos, para no dejar basura en el store. Igual que en
  // api/admin/imagen.js: el token explícito gana al OIDC del entorno.
  if (creados.blobs.length > 0) {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    await del(creados.blobs, token ? { token } : undefined)
    creados.blobs.length = 0
  }
})

test('el cartel subido al crear un evento llega a la base de datos, al panel y a la agenda pública', async ({
  page,
}, info) => {
  const titulo = tituloDe(info)

  await iniciarSesionAdmin(page)
  await page.goto('/admin/eventos/nuevo')

  await page.locator('#titulo').fill(titulo)
  await page.locator('#descripcion').fill(EVENTO.descripcion)
  await page.locator('#categoria').selectOption(EVENTO.categoria)
  await page.locator('#lugar').fill(EVENTO.lugar)
  await page.locator('#fecha').fill(EVENTO.fecha)
  await page.locator('#hora').fill(EVENTO.hora)

  const urlCartel = await subirCartel(page)

  await page.getByRole('button', { name: 'Publicar evento' }).click()
  await expect(page).toHaveURL(/\/admin$/)

  // 1. La URL quedó guardada en eventos_usuario.
  const guardado = await eventoEnLaBaseDeDatos(page, titulo)
  expect(guardado, 'el evento debe existir en la base de datos').toBeTruthy()
  expect(guardado.imagen).toBe(urlCartel)
  creados.eventos.push(guardado.id)

  // 2. Se ve en el panel de administración.
  const enPanel = page.locator('main ul > li').filter({ hasText: titulo }).locator('img')
  await imagenSeCarga(enPanel)
  await expect(enPanel).toHaveAttribute('src', urlCartel)

  // 3. Y en la agenda pública, sin pasar por el panel.
  const publicos = await page.request.get('/api/eventos')
  const { eventos } = await publicos.json()
  const publicado = eventos.find((e) => e.titulo === titulo)
  expect(publicado, 'el evento publicado debe salir en /api/eventos').toBeTruthy()
  expect(publicado.imagen).toBe(urlCartel)

  await page.addInitScript(() => localStorage.setItem('ncv_access', 'true'))
  await page.goto(`/eventos/${publicado.id}`)

  const cartelPublico = page.getByAltText(titulo)
  await imagenSeCarga(cartelPublico)
  await expect(cartelPublico).toHaveAttribute('src', urlCartel)
})

test('al editar un evento se puede reemplazar el cartel y el cambio se propaga', async ({
  page,
}, info) => {
  const titulo = tituloDe(info)

  await iniciarSesionAdmin(page)

  const antes = await eventoEnLaBaseDeDatos(page, titulo)
  expect(antes, 'el test anterior debe haber creado el evento').toBeTruthy()
  const urlAnterior = antes.imagen

  await page.goto(`/admin/eventos/${antes.id}/editar`)

  // El formulario llega prerrellenado con el cartel que ya tenía.
  const vistaPrevia = page.getByAltText('Cartel del evento')
  await expect(vistaPrevia).toHaveAttribute('src', urlAnterior)

  await page.getByRole('button', { name: 'Quitar' }).click()
  await expect(vistaPrevia).toHaveCount(0)

  const urlNueva = await subirCartel(page)
  expect(urlNueva, 'cada subida crea un blob distinto').not.toBe(urlAnterior)

  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page).toHaveURL(/\/admin$/)

  const despues = await eventoEnLaBaseDeDatos(page, titulo)
  expect(despues.imagen).toBe(urlNueva)

  const enPanel = page.locator('main ul > li').filter({ hasText: titulo }).locator('img')
  await imagenSeCarga(enPanel)
  await expect(enPanel).toHaveAttribute('src', urlNueva)

  await page.addInitScript(() => localStorage.setItem('ncv_access', 'true'))
  await page.goto(`/eventos/bd-${despues.id}`)

  const cartelPublico = page.getByAltText(titulo)
  await imagenSeCarga(cartelPublico)
  await expect(cartelPublico).toHaveAttribute('src', urlNueva)
})
