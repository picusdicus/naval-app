import { test, expect } from '@playwright/test'

test.describe('Admin Superadmin Panel', () => {
  test.beforeEach(async ({ page }) => {
    // /admin es a la vez el login y el panel del superadmin: al enviar el
    // formulario se aterriza directamente en el panel, sin pasar por /admin/super.
    await page.goto('/admin')
    await page.fill('input[type="email"]', process.env.SUPER_ADMIN_EMAIL || 'superadmin@navalcarnero.es')
    await page.fill('input[type="password"]', process.env.SUPER_ADMIN_PASSWORD || 'superadmin123456')
    await page.click('button[type="submit"]')
    await page.waitForURL('/admin')
  })

  test('should show the superadmin panel right after login', async ({ page }) => {
    await expect(page.locator('h1:has-text("Panel Superadmin")')).toBeVisible()
  })

  test('superadmin panel should have three tabs', async ({ page }) => {
    const tabs = page.locator('button').filter({ hasText: /Organizaciones|Códigos de invitación|Analytics/ })
    const count = await tabs.count()
    expect(count).toBe(3)
  })

  test('organizaciones tab should show list and create button', async ({ page }) => {
    // Check organizations tab
    const orgTab = page.locator('button:has-text("Organizaciones")')
    await expect(orgTab).toBeVisible()

    // Should show "Nueva organización" button
    const createBtn = page.locator('button:has-text("Nueva organización")')
    await expect(createBtn).toBeVisible()
  })

  test('should load organizations list', async ({ page }) => {
    // Wait for table to be visible
    await page.waitForSelector('table')
    const table = page.locator('table')
    await expect(table).toBeVisible()

    // Check for at least the header row
    const headers = page.locator('th')
    await expect(headers.first()).toContainText('Nombre')
  })

  test('codigos tab should show list and create button', async ({ page }) => {
    const codigosTab = page.locator('button:has-text("Códigos de invitación")')
    await codigosTab.click()

    const createBtn = page.locator('button:has-text("Nuevo código")')
    await expect(createBtn).toBeVisible()
  })

  test('analytics tab should show metrics', async ({ page }) => {
    const analyticsTab = page.locator('button:has-text("Analytics")')
    await analyticsTab.click()

    // Check for summary metrics
    await expect(page).toContainText('Resumen general')
    await expect(page.locator('text=Organizaciones activas')).toBeVisible()
  })

  test('sin sesión, /admin muestra el login en vez del panel', async ({ page, context }) => {
    // Clear cookies to logout
    await context.clearCookies()

    await page.goto('/admin')

    // Debe verse el formulario de login, no las tabs del panel.
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button:has-text("Organizaciones")')).toHaveCount(0)
  })
})
