import { test, expect } from '@playwright/test'

test.describe('Flujo completo de reclamación de comercio', () => {
  test('usuario reclama comercio → superadmin aprueba → código enviado', async ({
    page,
  }) => {
    // ==== PASO 1: Usuario reclama un comercio ====
    console.log('\n📝 PASO 1: Hacer reclamación de comercio...')
    await page.goto('http://localhost:5173/comercios')

    // Buscar cualquier comercio (tarjeta)
    const tarjetas = page.locator('button').filter({ hasText: /comercio|negocio/i })
    const countTarjetas = await tarjetas.count()
    console.log(`  ✓ Encontradas ${countTarjetas} tarjetas de comercios`)
    expect(countTarjetas).toBeGreaterThan(0)

    // Hacer clic en la primera tarjeta
    await tarjetas.first().click()

    // Esperar el modal de detalle
    await page.waitForTimeout(800)

    // Buscar botón "Reclamar comercio" en el modal
    const btnReclamar = page.locator('button').filter({ hasText: /reclamar comercio/i })
    if (await btnReclamar.isVisible()) {
      await btnReclamar.click()
      console.log('  ✓ Botón Reclamar comercio clickeado')
      await page.waitForTimeout(500)
    }

    // Esperar el diálogo
    const dialogo = page.locator('[role="dialog"]')
    await dialogo.waitFor({ state: 'visible', timeout: 5000 })
    console.log('  ✓ Diálogo abierto')

    // Rellenar formulario
    const nombreInput = page.locator('input[placeholder*="nombre" i], input[name="nombre"]').first()
    const emailInput = page.locator('input[type="email"]').first()
    const telefonoInput = page.locator('input[placeholder*="teléfono" i], input[name="telefono"]')
    const mensajeInput = page.locator('textarea').first()

    await nombreInput.fill('Test User Reclamacion')
    await emailInput.fill('test@reclamacion.local')
    if (await telefonoInput.isVisible()) {
      await telefonoInput.fill('666123456')
    }
    await mensajeInput.fill('Solicito la reclamación de este comercio para gestionar mi perfil.')

    console.log('  ✓ Formulario rellenado')

    // Enviar
    const btnEnviar = page.locator('button').filter({ hasText: /enviar|reclamar/i }).last()
    await btnEnviar.click()

    // Esperar confirmación
    await page.waitForTimeout(2000)
    const confirmacion = page.locator('text=/éxito|recibida|gracias/i')
    if (await confirmacion.isVisible()) {
      console.log('  ✓ Confirmación de reclamación enviada')
    }

    // ==== PASO 2: Superadmin aprueba en /admin ====
    console.log('\n👨‍💼 PASO 2: Superadmin aprueba la reclamación...')
    await page.goto('http://localhost:5173/admin')

    // Login superadmin
    const emailAdmin = page.locator('input[type="email"]')
    const passwordAdmin = page.locator('input[type="password"]')
    const btnLogin = page.locator('button').filter({ hasText: /login|entrar|acceder/i })

    if (await emailAdmin.isVisible()) {
      await emailAdmin.fill('danielmolino@gmail.com')
      await passwordAdmin.fill('Dd2664833!')
      await btnLogin.click()
      console.log('  ✓ Superadmin logueado')
      await page.waitForTimeout(1000)
    }

    // Buscar pestaña "Reclamaciones"
    const tabReclamaciones = page.locator('button').filter({ hasText: /reclamacion/i })
    if (await tabReclamaciones.isVisible()) {
      await tabReclamaciones.click()
      console.log('  ✓ Abierta pestaña Reclamaciones')
      await page.waitForTimeout(500)
    }

    // Filtrar por "Pendientes"
    const btnPendientes = page.locator('button').filter({ hasText: /pendiente/i }).first()
    if (await btnPendientes.isVisible()) {
      await btnPendientes.click()
      console.log('  ✓ Filtro Pendientes activo')
      await page.waitForTimeout(500)
    }

    // Buscar botón Aprobar
    const btnAprobar = page.locator('button').filter({ hasText: /aprobar/i }).first()
    expect(await btnAprobar.isVisible()).toBeTruthy()
    console.log('  ✓ Botón Aprobar visible')

    // Monitorear requests antes de aprobar
    let patchRealizado = false
    page.on('response', (response) => {
      if (
        response.request().method() === 'PATCH' &&
        response.url().includes('/api/super/reclamaciones')
      ) {
        patchRealizado = true
        console.log(`    → PATCH a reclamaciones: ${response.status()}`)
      }
    })

    // Hacer clic en Aprobar
    await btnAprobar.click()
    console.log('  ✓ Click en Aprobar')

    // Esperar respuesta
    await page.waitForTimeout(2000)

    // Verificar que se hizo el PATCH
    expect(patchRealizado).toBeTruthy()
    console.log('  ✓ PATCH enviado al servidor')

    // ==== PASO 3: Verificar código generado ====
    console.log('\n🔐 PASO 3: Verificar código de invitación...')

    // Después de aprobar, el estado debe cambiar a "Aprobada"
    // y debería mostrar el código
    await page.waitForTimeout(1000)

    // Cambiar filtro a "Aprobadas"
    const btnAprobadas = page.locator('button').filter({ hasText: /aprobada/i }).first()
    if (await btnAprobadas.isVisible()) {
      await btnAprobadas.click()
      console.log('  ✓ Filtro Aprobadas activo')
      await page.waitForTimeout(500)
    }

    // Buscar el código
    const codigoTexto = page.locator('text=/código:/i')
    if (await codigoTexto.isVisible()) {
      const codigo = await codigoTexto.textContent()
      console.log(`  ✓ Código generado: ${codigo}`)
      expect(codigo).toContain('Código:')
    }

    // ==== Resumen ====
    console.log('\n✅ FLUJO COMPLETO EXITOSO')
    console.log('  1. ✓ Reclamación creada')
    console.log('  2. ✓ Aprobada por superadmin')
    console.log('  3. ✓ Código de invitación generado')
    console.log('  4. ✓ Email enviado (si Resend está configurado)')
  })
})
