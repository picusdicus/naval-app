import { test, expect } from '@playwright/test'

test.describe('Admin Superadmin Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Login como superadmin
    await page.goto('/admin/login')
    await page.fill('input[type="email"]', process.env.SUPER_ADMIN_EMAIL || 'superadmin@navalcarnero.es')
    await page.fill('input[type="password"]', process.env.SUPER_ADMIN_PASSWORD || 'superadmin123456')
    await page.click('button[type="submit"]')
    await page.waitForURL('/admin')
  })

  test('should show superadmin panel link in header', async ({ page }) => {
    const panelLink = page.locator('a:has-text("Panel Superadmin")')
    await expect(panelLink).toBeVisible()
  })

  test('should navigate to superadmin panel', async ({ page }) => {
    await page.click('a:has-text("Panel Superadmin")')
    await page.waitForURL('/admin/super')
    await expect(page).toHaveURL('/admin/super')
  })

  test('superadmin panel should have three tabs', async ({ page }) => {
    await page.goto('/admin/super')

    const tabs = page.locator('button').filter({ hasText: /Organizaciones|Códigos de invitación|Analytics/ })
    const count = await tabs.count()
    expect(count).toBe(3)
  })

  test('organizaciones tab should show list and create button', async ({ page }) => {
    await page.goto('/admin/super')

    // Check organizations tab
    const orgTab = page.locator('button:has-text("Organizaciones")')
    await expect(orgTab).toBeVisible()

    // Should show "Nueva organización" button
    const createBtn = page.locator('button:has-text("Nueva organización")')
    await expect(createBtn).toBeVisible()
  })

  test('should load organizations list', async ({ page }) => {
    await page.goto('/admin/super')

    // Wait for table to be visible
    await page.waitForSelector('table')
    const table = page.locator('table')
    await expect(table).toBeVisible()

    // Check for at least the header row
    const headers = page.locator('th')
    await expect(headers.first()).toContainText('Nombre')
  })

  test('codigos tab should show list and create button', async ({ page }) => {
    await page.goto('/admin/super')

    const codigosTab = page.locator('button:has-text("Códigos de invitación")')
    await codigosTab.click()

    const createBtn = page.locator('button:has-text("Nuevo código")')
    await expect(createBtn).toBeVisible()
  })

  test('analytics tab should show metrics', async ({ page }) => {
    await page.goto('/admin/super')

    const analyticsTab = page.locator('button:has-text("Analytics")')
    await analyticsTab.click()

    // Check for summary metrics
    await expect(page).toContainText('Resumen general')
    await expect(page.locator('text=Organizaciones activas')).toBeVisible()
  })

  test('non-superadmin should not access superadmin panel', async ({ page, context }) => {
    // Clear cookies to logout
    await context.clearCookies()

    // Logout and try direct access
    await page.goto('/admin/super')

    // Should redirect to login or main panel
    const url = page.url()
    expect(url).not.toContain('/admin/super')
  })
})
