// POST /api/solicitar-reclamacion — { comercioId, nombre, email, telefono, mensaje, recaptchaToken }
// Registra una solicitud anónima de reclamación de un comercio.
// Rate-limited por IP + reCAPTCHA v3 validation.
import { obtenerSql } from './_db.js'
import { limitar, obtenerIp } from './_ratelimit.js'

export const config = { runtime: 'nodejs' }

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

async function enviarEmailReclamacion({ solicitudId, comercioId, nombre, email, telefono, mensaje, createdAt }) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurado, email no enviado')
    return { ok: true, skipped: true }
  }

  try {
    const fechaFormato = new Date(createdAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })

    // Email al admin
    const asuntoAdmin = `Nueva solicitud de reclamación: ${comercioId} [${solicitudId.substring(0, 8)}]`
    const contenidoAdmin = `
      <h2>Nueva Solicitud de Reclamación de Comercio</h2>
      <p><strong>ID de Solicitud:</strong> ${solicitudId}</p>
      <p><strong>Comercio ID:</strong> ${comercioId}</p>
      <p><strong>Nombre del reclamante:</strong> ${nombre}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Teléfono:</strong> ${telefono || 'No proporcionado'}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${mensaje}</p>
      <p><strong>Fecha de solicitud:</strong> ${fechaFormato}</p>
    `

    const responseAdmin = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: ADMIN_EMAIL,
        subject: asuntoAdmin,
        html: contenidoAdmin,
      }),
    })

    if (!responseAdmin.ok) {
      const error = await responseAdmin.text()
      console.error('Error al enviar email al admin con Resend:', error)
      return { ok: false, error: error }
    }

    // Email al solicitante
    const asuntoSolicitante = `Tu solicitud de reclamación ha sido recibida [${solicitudId.substring(0, 8)}]`
    const contenidoSolicitante = `
      <h2>Confirmación de Solicitud de Reclamación</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu solicitud de reclamación para el comercio <strong>${comercioId}</strong> ha sido recibida correctamente.</p>
      <p><strong>ID de Solicitud:</strong> <code>${solicitudId}</code></p>
      <p>Por favor, guarda este ID para poder hacer seguimiento de tu solicitud. Te contactaremos en breve para verificar tu identidad.</p>
      <hr style="border:none; border-top:1px solid #ddd; margin: 20px 0;">
      <p style="color:#666; font-size:12px;">
        Fecha de solicitud: ${fechaFormato}<br>
        Este es un email automático, por favor no respondas.
      </p>
    `

    // En desarrollo, enviar a danielmolino@gmail.com (único email verificado en Resend)
    const esProduccion = process.env.NODE_ENV === 'production'
    const emailDestino = esProduccion ? email : ADMIN_EMAIL
    const asuntoConMarca = esProduccion ? asuntoSolicitante : `${asuntoSolicitante} [TEST: ${email}]`

    const responseSolicitante = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: emailDestino,
        subject: asuntoConMarca,
        html: contenidoSolicitante,
      }),
    })

    if (!responseSolicitante.ok) {
      const error = await responseSolicitante.text()
      console.error('Error al enviar email al solicitante con Resend:', error)
      return { ok: false, error: error }
    }

    console.log(`Emails enviados exitosamente${!esProduccion ? ` (confirmación enviada a ${emailDestino}, original: ${email})` : ''}`)
    return { ok: true }
  } catch (error) {
    console.error('Error al enviar emails:', error.message)
    return { ok: false, error: error.message }
  }
}

export default async function handler(req, res) {
  console.log(`[solicitar-reclamacion] ${req.method} ${req.url}`)

  if (req.method !== 'POST') {
    return respuestaJson(res, { error: 'Método no permitido' }, 405)
  }

  // En localhost, saltarse el rate-limit para facilitar testing
  const esLocalhost = req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1')
  if (!esLocalhost) {
    const ip = obtenerIp(req)
    const limite = await limitar({ clave: `reclamacion:ip:${ip}`, limite: 5, ventanaS: 60 * 60 })
    if (!limite.ok) {
      return respuestaJson(res, { error: 'Demasiadas solicitudes. Intenta más tarde.' }, 429)
    }
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

    // Insertar la solicitud con estado pendiente y recuperar el ID
    const resultado = await sql`
      INSERT INTO solicitudes_reclamacion (comercio_id, nombre, email, telefono, mensaje, estado)
      VALUES (
        ${String(comercioId).trim()},
        ${String(nombre).trim()},
        ${emailTrimmed},
        ${telefono ? String(telefono).trim() : null},
        ${String(mensaje).trim()},
        'pendiente'
      )
      RETURNING id, creado_en
    `

    const solicitudId = resultado[0].id
    const createdAt = resultado[0].creado_en

    console.log('[solicitar-reclamacion] Solicitud guardada:', solicitudId)

    // Enviar emails al admin y al solicitante (fail-soft: no romper la respuesta si falla)
    const resultadoEmail = await enviarEmailReclamacion({
      solicitudId,
      comercioId: String(comercioId).trim(),
      nombre: String(nombre).trim(),
      email: emailTrimmed,
      telefono: telefono ? String(telefono).trim() : null,
      mensaje: String(mensaje).trim(),
      createdAt,
    })

    if (!resultadoEmail.ok && !resultadoEmail.skipped) {
      console.error('[solicitar-reclamacion] Fallo al enviar emails de notificación, pero la solicitud se guardó')
    }

    return respuestaJson(res, { ok: true, solicitudId }, 201)
  } catch (error) {
    console.error('[solicitar-reclamacion] Error:', error)
    return respuestaJson(res, { error: 'Error en el servidor. Intenta de nuevo.' }, 500)
  }
}
