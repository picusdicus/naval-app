import { test, expect } from '@playwright/test'
import { SESION_SUPER, SIN_SESION } from './entorno.js'
import { irASeccion } from './_panel.js'

// Alta manual de un comercio desde el tab Comercios de /admin.
//
// El envío del formulario se intercepta con page.route: el endpoint real hace
// un commit a main de servicios-locales.json, y un test no debe publicar
// fichas de prueba en producción. Lo que sí se ataca en vivo es la parte del
// endpoint que no escribe nada: la sesión, el CSRF y la validación (400).
test.use({ storageState: SESION_SUPER })

const FICHA = {
  nombre: 'Bar de Prueba E2E',
  categoria: 'restauracion',
  subtipo: 'bar',
  tipoDisplay: 'Bar de tapas',
  direccion: 'Plaza de Segovia, 1, Navalcarnero',
  telefono: '918 11 22 33',
  web: 'https://bar-prueba.example',
  mapsUrl: 'https://maps.google.com/?cid=1234567890',
  lat: '40,2870',
  lng: '-4,0105',
  horario: 'lunes: Cerrado | martes: 9:00–23:00',
  descripcion: 'Tapas y raciones en la plaza.',
}

test('el botón abre el formulario completo y envía la ficha con la forma de Places', async ({ page }) => {
  await page.goto('/admin')
  await irASeccion(page, 'Comercios')

  const boton = page.getByRole('button', { name: 'Añadir comercio' })
  await expect(boton).toBeVisible()
  await boton.click()

  const form = page.getByTestId('formulario-comercio-manual')
  await expect(form).toBeVisible()

  // Enviar vacío: la validación del cliente marca los cuatro obligatorios y
  // no llama al servidor.
  let llamadas = 0
  await page.route('**/api/super/comercios-alta', async (ruta) => {
    llamadas++
    const cuerpo = ruta.request().postDataJSON()
    await ruta.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        comercio: { ...cuerpo, id: 'local/restauracion-bar-de-prueba-e2e', fuente: 'alta-manual' },
      }),
    })
  })
  await form.getByRole('button', { name: 'Dar de alta', exact: true }).click()
  await expect(form.getByText('El nombre es obligatorio.')).toBeVisible()
  await expect(form.getByText('Elige una categoría.')).toBeVisible()
  await expect(form.getByText('Elige una subcategoría.')).toBeVisible()
  await expect(form.getByText('La dirección es obligatoria.')).toBeVisible()
  expect(llamadas).toBe(0)

  // Rellenar todos los campos de una ficha de Places.
  await form.locator('#cm-nombre').fill(FICHA.nombre)
  await form.locator('#cm-categoria').selectOption(FICHA.categoria)
  await form.locator('#cm-subtipo').selectOption(FICHA.subtipo)
  await form.locator('#cm-tipoDisplay').fill(FICHA.tipoDisplay)
  await form.locator('#cm-direccion').fill(FICHA.direccion)
  await form.locator('#cm-telefono').fill(FICHA.telefono)
  await form.locator('#cm-web').fill(FICHA.web)
  await form.locator('#cm-mapsUrl').fill(FICHA.mapsUrl)
  await form.locator('#cm-lat').fill(FICHA.lat)
  await form.locator('#cm-lng').fill(FICHA.lng)
  await form.locator('#cm-horario').fill(FICHA.horario)
  await form.locator('#cm-descripcion').fill(FICHA.descripcion)
  await form.locator('#cm-precioNivel').selectOption('MODERATE')
  // Las cocinas solo aparecen con la categoría restauración elegida.
  await form.getByRole('button', { name: 'Tapas' }).click()
  await form.getByLabel('Terraza').check()
  await form.getByLabel('Acepta tarjeta').check()

  const [peticion] = await Promise.all([
    page.waitForRequest('**/api/super/comercios-alta'),
    form.getByRole('button', { name: 'Dar de alta', exact: true }).click(),
  ])
  const enviado = peticion.postDataJSON()
  expect(enviado).toMatchObject({
    nombre: FICHA.nombre,
    categoria: 'restauracion',
    subtipo: 'bar',
    tipoDisplay: FICHA.tipoDisplay,
    direccion: FICHA.direccion,
    telefono: FICHA.telefono,
    web: FICHA.web,
    mapsUrl: FICHA.mapsUrl,
    lat: FICHA.lat,
    lng: FICHA.lng,
    horario: FICHA.horario,
    descripcion: FICHA.descripcion,
    precioNivel: 'MODERATE',
    cocina: ['tapas'],
    atributos: { terraza: true, tarjeta: true },
    cerradoTemporal: false,
    forzar: false,
  })

  // Tras el alta: el formulario se cierra, hay aviso y la ficha nueva sale en
  // la lista marcada como alta manual (aunque el JSON del build no la traiga).
  await expect(form).toBeHidden()
  await expect(page.getByText(/dado de alta \(local\/restauracion-bar-de-prueba-e2e\)/)).toBeVisible()
  await expect(page.getByText(FICHA.nombre, { exact: true })).toBeVisible()
  await expect(page.getByText('· alta manual')).toBeVisible()
})

test('el endpoint exige sesión, mismo origen y campos válidos', async ({ page, playwright, baseURL }) => {
  // Con sesión, pero cuerpo inválido: 400 con los errores por campo.
  const res400 = await page.request.post('/api/super/comercios-alta', {
    headers: { Origin: baseURL },
    data: { nombre: '', categoria: 'restauracion', subtipo: 'bar', direccion: 'x', lat: '99', lng: '0', cocina: [], atributos: {} },
  })
  expect(res400.status()).toBe(400)
  const { errores } = await res400.json()
  expect(errores.nombre).toBeTruthy()
  expect(errores.lat).toBeTruthy()

  // Nombre ya existente en comercios.json: 409 con el duplicado, sin commit
  // (la comprobación va antes de escribir; solo lee servicios-locales del repo).
  const res409 = await page.request.post('/api/super/comercios-alta', {
    headers: { Origin: baseURL },
    data: { nombre: 'ahorramás', categoria: 'alimentacion', subtipo: 'supermarket', direccion: 'Calle Falsa, 1', cocina: [], atributos: {} },
  })
  expect(res409.status()).toBe(409)
  const { duplicado } = await res409.json()
  expect(duplicado.nombre).toBe('Ahorramas')

  // Origin ajeno: 403 antes de mirar nada más.
  const res403 = await page.request.post('/api/super/comercios-alta', {
    headers: { Origin: 'https://otro.example' },
    data: {},
  })
  expect(res403.status()).toBe(403)

  // Sin cookie: 401. El fixture `request` del proyecto hereda la sesión
  // guardada, así que hace falta un contexto propio sin cookies.
  const anonimo = await playwright.request.newContext({ baseURL, storageState: SIN_SESION })
  try {
    const res401 = await anonimo.post('/api/super/comercios-alta', { headers: { Origin: baseURL }, data: {} })
    expect(res401.status()).toBe(401)
  } finally {
    await anonimo.dispose()
  }
})
