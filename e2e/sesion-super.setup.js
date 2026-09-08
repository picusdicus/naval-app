import { test as setup, expect } from '@playwright/test'
import { SESION_SUPER, exigir } from './entorno.js'
import { prepararDirectorio, sesionValida } from './_sesiones.js'

// Inicia sesión como superadmin una vez y deja la cookie en disco, para que
// ningún spec vuelva a pasar por el formulario. El porqué (rate-limit de
// 5 intentos / 15 min) está en entorno.js, junto a las rutas.

setup('sesión de superadmin', async ({ page, playwright }) => {
  prepararDirectorio()
  if (await sesionValida(playwright, SESION_SUPER, 'superadmin')) return

  // /admin es a la vez el login y el panel: al enviar se aterriza en el panel.
  await page.goto('/admin')
  await page.fill('input[type="email"]', exigir('SUPER_ADMIN_EMAIL'))
  await page.fill('input[type="password"]', exigir('SUPER_ADMIN_PASSWORD'))
  await page.click('button[type="submit"]')
  await page.waitForURL('/admin')
  await expect(page.locator('h1:has-text("Panel Superadmin")')).toBeVisible()

  await page.context().storageState({ path: SESION_SUPER })
})
