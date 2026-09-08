import { test, expect } from '@playwright/test'
import { SESION_SUPER, SIN_SESION } from './entorno.js'

// La sesión llega del proyecto `setup` (e2e/sesion.setup.js). Antes cada uno
// de estos tests hacía su propio login en un beforeEach: ocho por viewport,
// contra un límite de cinco cada quince minutos, así que la mayoría fallaba
// con "Demasiadas peticiones" en vez de comprobar nada.
test.use({ storageState: SESION_SUPER })

test.describe('Admin Superadmin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin')
  })

  test('should show the superadmin panel right after login', async ({ page }) => {
    await expect(page.locator('h1:has-text("Panel Superadmin")')).toBeVisible()
  })

  test('superadmin panel should have four tabs', async ({ page }) => {
    const tabs = page.locator('button').filter({ hasText: /Organizaciones|Códigos de invitación|Destacados|Analytics/ })
    const count = await tabs.count()
    expect(count).toBe(4)
  })

  test('organizaciones tab should show list and create button', async ({ page }) => {
    // Check organizations tab
    const orgTab = page.locator('button:has-text("Organizaciones")')
    await expect(orgTab).toBeVisible()

    // El alta se ofrece en dos sitios (cabecera y tarjeta al final de la
    // rejilla), así que se localiza por nombre accesible exacto: la tarjeta
    // lleva aria-label propio y no compite con este.
    const createBtn = page.getByRole('button', { name: 'Nueva organización', exact: true })
    await expect(createBtn).toBeVisible()
  })

  test('should load organizations list', async ({ page }) => {
    // La lista es una rejilla de tarjetas, no una tabla: se espera a que
    // llegue la primera y se comprueba que hay más de una.
    const tarjetas = page.getByTestId('tarjeta-organizacion')
    await expect(tarjetas.first()).toBeVisible()
    expect(await tarjetas.count()).toBeGreaterThan(1)

    // Las tres cifras de la tarjeta sustituyen a las cabeceras de la tabla.
    const primera = tarjetas.first()
    await expect(primera).toContainText('Eventos')
    await expect(primera).toContainText('Usuarios')
    await expect(primera).toContainText('Códigos')
  })

  test('codigos tab should show list and create button', async ({ page }) => {
    const codigosTab = page.locator('button:has-text("Códigos de invitación")')
    await codigosTab.click()

    // Mismo motivo que en Organizaciones: el alta se ofrece en la cabecera y
    // como tarjeta al final de la rejilla, así que se localiza por nombre
    // accesible exacto (la tarjeta lleva aria-label propio).
    const createBtn = page.getByRole('button', { name: 'Nuevo código', exact: true })
    await expect(createBtn).toBeVisible()

    // La lista es una rejilla de tarjetas, no una tabla. Hasta ahora nada
    // comprobaba su contenido: se afirma que carga y que cada tarjeta trae la
    // organización, los usos y la acción de copiar.
    const tarjetas = page.getByTestId('tarjeta-codigo')
    await expect(tarjetas.first()).toBeVisible()

    const primera = tarjetas.first()
    await expect(primera).toContainText('Usos')
    await expect(primera.getByRole('button', { name: /^Copiar código / })).toBeVisible()
  })

  test('destacados tab should show cards and create button', async ({ page }) => {
    const destacadosTab = page.locator('button:has-text("Destacados")')
    await destacadosTab.click()

    // Mismo motivo que en Organizaciones y Códigos: el alta se ofrece en la
    // cabecera y como tarjeta al final de la rejilla, así que se localiza por
    // nombre accesible exacto (la tarjeta lleva aria-label propio).
    const createBtn = page.getByRole('button', { name: 'Nuevo destacado', exact: true })
    await expect(createBtn).toBeVisible()

    // La lista es una rejilla de tarjetas, no una tabla. La base real puede
    // estar vacía, así que vale cualquiera de las dos salidas; lo que se
    // afirma es que la pestaña resuelve y, si hay campañas, que cada tarjeta
    // trae su vigencia y sus dos acciones rotuladas.
    const tarjetas = page.getByTestId('tarjeta-destacado')
    const vacio = page.locator('text=No hay destacados.')
    await expect(tarjetas.first().or(vacio)).toBeVisible()

    if ((await tarjetas.count()) > 0) {
      const primera = tarjetas.first()
      await expect(primera).toContainText('Orden')
      await expect(primera.getByRole('button', { name: /^Editar el destacado / })).toBeVisible()
      await expect(primera.getByRole('button', { name: /^Eliminar el destacado / })).toBeVisible()
    }
  })

  test('analytics tab should show metrics', async ({ page }) => {
    const analyticsTab = page.locator('button:has-text("Analytics")')
    await analyticsTab.click()

    // Check for summary metrics
    await expect(page.locator('body')).toContainText('Resumen general')
    await expect(page.locator('text=Organizaciones activas')).toBeVisible()
  })

  // storageState propio: sin él heredaría la cookie del fichero de sesión y
  // este test no probaría nada. clearCookies() ya no basta, porque el contexto
  // nace autenticado.
  test('sin sesión, /admin muestra el login en vez del panel', async ({ browser }) => {
    const contexto = await browser.newContext({ storageState: SIN_SESION })
    const page = await contexto.newPage()

    await page.goto('/admin')

    // Debe verse el formulario de login, no las tabs del panel.
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button:has-text("Organizaciones")')).toHaveCount(0)

    await contexto.close()
  })
})
