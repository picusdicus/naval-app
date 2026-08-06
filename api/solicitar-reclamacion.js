// POST /api/solicitar-reclamacion — { comercioId, nombre, email, telefono, mensaje, recaptchaToken }
// Registra una solicitud anónima de reclamación de un comercio.
// Rate-limited por IP + reCAPTCHA v3 validation.
import { obtenerSql } from './_db.js'
import { limitar, obtenerIp } from './_ratelimit.js'

export const config = { runtime: 'node' }

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY
const RECAPTCHA_SCORE_MIN = 0.5
const RESEND_API_KEY = process.env.RESEND_API_KEY
const ADMIN_EMAIL = 'danielmolino@gmail.com'

function respuestaJson(res, datos, status = 200) {
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = status
  res.end(JSON.stringify(datos))
}

async function verificarRecaptcha(token, host) {
  const esLocalhost = host?.includes('localhost') || host?.includes('127.0.0.1')
  if (esLocalhost) {
    console.log('✓ reCAPTCHA deshabilitado en localhost')
    return { ok: true }
  }

  if (!RECAPTCHA_SECRET) {
    console.warn('RECAPTCHA_SECRET_KEY no configurado, skipping reCAPTCHA')
    return { ok: true }
  }

  if (!token) {
    return { ok: false, error: 'Token de reCAPTCHA inválido' }
  }

  try {
    const respuesta = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${RECAPTCHA_SECRET}&response=${token}`,
    })

    const resultado = await respuesta.json()
    if (!resultado.success || (resultado.score ?? 1) < RECAPTCHA_SCORE_MIN) {
      console.warn(`reCAPTCHA score ${resultado.score} bajo`, { action: resultado.action })
      return { ok: false, error: 'Verificación fallida. Intenta de nuevo.' }
    }

    return { ok: true }
  } catch (error) {
    console.error('Error al verificar reCAPTCHA:', error)
    return { ok: false, error: 'Error en la verificación. Intenta de nuevo.' }
  }
}

async function enviarEmailReclamacion({ comercioId, nombre, email, telefono, mensaje }) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurado, email no enviado')
    return { ok: true, skipped: true }
  }

  try {
    const asunto = `Nueva solicitud de reclamación: ${comercioId}`
    const contenido = `
      <h2>Nueva Solicitud de Reclamación de Comercio</h2>
      <p><strong>Comercio ID:</strong> ${comercioId}</p>
      <p><strong>Nombre del reclamante:</strong> ${nombre}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Teléfono:</strong> ${telefono || 'No proporcionado'}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${mensaje}</p>
      <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
    `

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: ADMIN_EMAIL,
        subject: asunto,
        html: contenido,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error al enviar email con Resend:', error)
      return { ok: false, error: error }
    }

    const resultado = await response.json()
    console.log('Email enviado exitosamente:', resultado.id)
    return { ok: true, id: resultado.id }
  } catch (error) {
    console.error('Error al enviar email:', error.message)
    return { ok: false, error: error.message }
  }
}

export default async function handler(req, res) {
  console.log(`[solicitar-reclamacion] ${req.method} ${req.url}`)

  if (req.method !== 'POST') {
    return respuestaJson(res, { error: 'Método no permitido' }, 405)
  }

  const ip = obtenerIp(req)
  const limite = await limitar({ clave: `reclamacion:ip:${ip}`, limite: 5, ventanaS: 60 * 60 })
  if (!limite.ok) {
    return respuestaJson(res, { error: 'Demasiadas solicitudes. Intenta más tarde.' }, 429)
  }

  const { comercioId, nombre, email, telefono, mensaje, recaptchaToken } = req.body || {}
  console.log('[solicitar-reclamacion] Body:', { comercioId, nombre, email })

  // Validar campos
  if (!comercioId || !nombre || !email || !mensaje) {
    return respuestaJson(res, { error: 'Faltan campos requeridos.' }, 400)
  }

  if (String(nombre).trim().length === 0 || String(nombre).length > 100) {
    return respuestaJson(res, { error: 'El nombre debe tener entre 1 y 100 caracteres.' }, 400)
  }

  const emailTrimmed = String(email).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed) || emailTrimmed.length > 254) {
    return respuestaJson(res, { error: 'Email no válido.' }, 400)
  }

  if (telefono && String(telefono).length > 20) {
    return respuestaJson(res, { error: 'El teléfono no puede superar 20 caracteres.' }, 400)
  }

  if (String(mensaje).length > 500) {
    return respuestaJson(res, { error: 'El mensaje no puede superar 500 caracteres.' }, 400)
  }

  // Verificar reCAPTCHA
  const captcha = await verificarRecaptcha(recaptchaToken, req.headers.host)
  if (!captcha.ok) {
    return respuestaJson(res, { error: captcha.error }, 403)
  }

  try {
    const sql = obtenerSql()

    // Insertar la solicitud con estado pendiente
    await sql`
      INSERT INTO solicitudes_reclamacion (comercio_id, nombre, email, telefono, mensaje, estado)
      VALUES (
        ${String(comercioId).trim()},
        ${String(nombre).trim()},
        ${emailTrimmed},
        ${telefono ? String(telefono).trim() : null},
        ${String(mensaje).trim()},
        'pendiente'
      )
    `

    console.log('[solicitar-reclamacion] Solicitud guardada:', comercioId)

    // Enviar email al admin (fail-soft: no romper la respuesta si falla)
    const resultadoEmail = await enviarEmailReclamacion({
      comercioId: String(comercioId).trim(),
      nombre: String(nombre).trim(),
      email: emailTrimmed,
      telefono: telefono ? String(telefono).trim() : null,
      mensaje: String(mensaje).trim(),
    })

    if (!resultadoEmail.ok && !resultadoEmail.skipped) {
      console.error('[solicitar-reclamacion] Fallo al enviar email de notificación, pero la solicitud se guardó')
    }

    return respuestaJson(res, { ok: true }, 201)
  } catch (error) {
    console.error('[solicitar-reclamacion] Error:', error)
    return respuestaJson(res, { error: 'Error en el servidor. Intenta de nuevo.' }, 500)
  }
}
