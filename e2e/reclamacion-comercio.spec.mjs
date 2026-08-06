import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5199'

test.describe('Reclamación de comercio', () => {
  test('enviar solicitud de reclamación y verificar email', async ({ page }) => {
    await page.goto(`${BASE_URL}/comercios`)

    // Buscar y hacer click en un comercio para ver el botón "Reclamar"
    // O navegar directamente a la modal si existe
    const botonReclamar = page.locator('button:has-text("Reclamar comercio")')

    if (await botonReclamar.isVisible()) {
      await botonReclamar.click()
    } else {
      // Si el botón no está visible, probamos directamente el endpoint
      console.log('Botón no visible, probando endpoint directamente...')
    }

    // Obtener un comercio del JSON para usar su ID
    const comercioId = 'gpl_test_123' // ID de prueba

    // Rellenar el formulario de reclamación
    const datos = {
      comercioId,
      nombre: 'Test User',
      email: 'test@example.com',
      telefono: '123456789',
      mensaje: 'Este es un mensaje de prueba para reclamar el comercio',
      recaptchaToken: 'test-token', // En localhost se salta reCAPTCHA
    }

    // Hacer POST directo al endpoint para una prueba más controlada
    const response = await page.request.post(`${BASE_URL}/api/solicitar-reclamacion`, {
      data: datos,
    })

    console.log('Response status:', response.status())
    console.log('Response body:', await response.json())

    // Verificar que la solicitud se guardó
    expect(response.status()).toBe(201)

    const body = await response.json()
    expect(body.ok).toBe(true)

    // NOTA: No podemos verificar directamente el email en la UI sin acceso a la bandeja,
    // pero el endpoint debería devolver 201 si todo está bien.
    // Para verificar que el email se envió, revisar:
    // 1. Los logs del servidor (console.log en api/_email.js)
    // 2. El dashboard de Resend en https://resend.com/emails
  })

  test('validar rate-limiting en reclamaciones', async ({ page }) => {
    const comercioId = 'gpl_test_rate_limit'
    const ip = '127.0.0.1' // Localhost

    // Enviar 6 solicitudes (límite es 5 por hora)
    for (let i = 0; i < 6; i++) {
      const response = await page.request.post(`${BASE_URL}/api/solicitar-reclamacion`, {
        data: {
          comercioId,
          nombre: `Test User ${i}`,
          email: `test${i}@example.com`,
          telefono: '123456789',
          mensaje: `Intento ${i + 1}`,
          recaptchaToken: 'test-token',
        },
      })

      if (i < 5) {
        // Los primeros 5 deben ser exitosos (201)
        expect(response.status()).toBe(201)
        console.log(`Solicitud ${i + 1}: OK (${response.status()})`)
      } else {
        // La 6ª debe estar limitada (429)
        expect(response.status()).toBe(429)
        console.log(`Solicitud ${i + 1}: RATE LIMITED (${response.status()})`)
      }
    }
  })

  test('validar campos requeridos', async ({ page }) => {
    const baseData = {
      comercioId: 'gpl_test_123',
      nombre: 'Test User',
      email: 'test@example.com',
      telefono: '123456789',
      mensaje: 'Test message',
      recaptchaToken: 'test-token',
    }

    // Prueba 1: Sin comercioId
    let response = await page.request.post(`${BASE_URL}/api/solicitar-reclamacion`, {
      data: { ...baseData, comercioId: undefined },
    })
    expect(response.status()).toBe(400)
    console.log('Test sin comercioId: OK')

    // Prueba 2: Sin nombre
    response = await page.request.post(`${BASE_URL}/api/solicitar-reclamacion`, {
      data: { ...baseData, nombre: undefined },
    })
    expect(response.status()).toBe(400)
    console.log('Test sin nombre: OK')

    // Prueba 3: Email inválido
    response = await page.request.post(`${BASE_URL}/api/solicitar-reclamacion`, {
      data: { ...baseData, email: 'email-invalido' },
    })
    expect(response.status()).toBe(400)
    console.log('Test email inválido: OK')

    // Prueba 4: Teléfono > 20 caracteres
    response = await page.request.post(`${BASE_URL}/api/solicitar-reclamacion`, {
      data: { ...baseData, telefono: '123456789012345678901' },
    })
    expect(response.status()).toBe(400)
    console.log('Test teléfono inválido: OK')

    // Prueba 5: Mensaje > 500 caracteres
    response = await page.request.post(`${BASE_URL}/api/solicitar-reclamacion`, {
      data: { ...baseData, mensaje: 'x'.repeat(501) },
    })
    expect(response.status()).toBe(400)
    console.log('Test mensaje inválido: OK')
  })
})
