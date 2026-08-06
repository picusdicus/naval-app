import { test, expect } from '@playwright/test'

test.describe('NavBar Mobile Layout', () => {
  test('should not show Inicio button on mobile', async ({ page }) => {
    await page.goto('/')

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // NavBar should be visible
    const navBar = page.locator('nav.lg\\:hidden')
    await expect(navBar).toBeVisible()

    // Inicio button should NOT exist
    const inicioButton = page.locator('nav.lg\\:hidden a:has-text("Inicio")')
    await expect(inicioButton).not.toBeVisible()
  })

  test('should show Eventos, Comercios, Noticias and Actividades on mobile', async ({ page }) => {
    await page.goto('/')

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    const navBar = page.locator('nav.lg\\:hidden')

    // All four buttons should be visible
    await expect(navBar.locator('a:has-text("Eventos")')).toBeVisible()
    await expect(navBar.locator('a:has-text("Comercios")')).toBeVisible()
    await expect(navBar.locator('a:has-text("Noticias")')).toBeVisible()
    await expect(navBar.locator('a:has-text("Actividades")')).toBeVisible()
  })

  test('Actividades should be positioned on the right on mobile', async ({ page }) => {
    await page.goto('/')

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    const navBar = page.locator('nav.lg\\:hidden')
    const eventosButton = navBar.locator('a:has-text("Eventos")')
    const actividadesButton = navBar.locator('a:has-text("Actividades")')

    // Get bounding boxes
    const eventosBbox = await eventosButton.boundingBox()
    const actividadesBbox = await actividadesButton.boundingBox()

    // Actividades should be to the right of Eventos (higher x coordinate)
    expect(actividadesBbox.x).toBeGreaterThan(eventosBbox.x + eventosBbox.width)
  })

  test('buttons should be evenly distributed with Actividades on the right', async ({ page }) => {
    await page.goto('/')

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    const navBar = page.locator('nav.lg\\:hidden')
    const buttons = navBar.locator('a')

    // Should have exactly 4 buttons
    const count = await buttons.count()
    expect(count).toBe(4)

    // Get bounding boxes for all buttons
    const bboxes = []
    for (let i = 0; i < count; i++) {
      const bbox = await buttons.nth(i).boundingBox()
      bboxes.push(bbox)
    }

    // Last button (Actividades) should have ml-auto class
    const actividadesButton = navBar.locator('a:has-text("Actividades")')
    const classes = await actividadesButton.getAttribute('class')
    expect(classes).toContain('ml-auto')

    // Actividades should be rightmost
    expect(bboxes[3].x).toBeGreaterThan(bboxes[2].x)
  })
})
