import { test as setup, expect } from '@playwright/test'
import { SESION_ORG, exigir } from './entorno.js'
import { prepararDirectorio, sesionValida } from './_sesiones.js'

// Gemelo de sesion-super.setup.js para el tier de organización. Proyecto
// aparte a propósito: si estas credenciales no valen, solo se quedan sin
// correr los specs de /panel, no la suite entera.

setup('sesión de organización', async ({ page, playwright }) => {
  prepararDirectorio()
  if (await sesionValida(playwright, SESION_ORG, 'organizacion')) return

  await page.goto('/login')
  await page.locator('#email').fill(exigir('ADMIN_EMAIL'))
  await page.locator('#password').fill(exigir('ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Acceder' }).click()
  // Un fallo aquí suele ser ADMIN_EMAIL/ADMIN_PASSWORD sin correspondencia en
  // la tabla `usuarios` (el login responde 401), no un problema del test.
  await expect(page).toHaveURL(/\/panel$/)

  await page.context().storageState({ path: SESION_ORG })
})
