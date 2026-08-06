// POST /api/solicitar-reclamacion — { comercioId, nombre, email, telefono, mensaje, recaptchaToken }
// Registra una solicitud anónima de reclamación de un comercio.
// Rate-limited por IP + reCAPTCHA v3 validation.
import { obtenerSql } from './_db.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from './_http.js'
import { limitar, obtenerIp, respuesta429 } from './_ratelimit.js'
import { enviarEmailReclamacion } from './_email.js'

export const config = { runtime: 'node' }

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY
const RECAPTCHA_SCORE_MIN = 0.5

async function verificarRecaptcha(token, req) {
  // En development, saltarse reCAPTCHA
  const esLocalhost = req.headers.get('host')?.includes('localhost') || req.headers.get('host')?.includes('127.0.0.1')
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

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }
  if (csrfInvalido(req)) return rechazoCsrf()

  const ip = obtenerIp(req)
  const limite = await limitar({ clave: `reclamacion:ip:${ip}`, limite: 5, ventanaS: 60 * 60 })
  if (!limite.ok) return respuesta429(limite.resetEnS)

  const { comercioId, nombre, email, telefono, mensaje, recaptchaToken } = await leerJson(req)

  // Validar campos
  if (!comercioId || !nombre || !email || !mensaje) {
    return json({ error: 'Faltan campos requeridos.' }, 400)
  }

  if (String(nombre).trim().length === 0 || String(nombre).length > 100) {
    return json({ error: 'El nombre debe tener entre 1 y 100 caracteres.' }, 400)
  }

  const emailTrimmed = String(email).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed) || emailTrimmed.length > 254) {
    return json({ error: 'Email no válido.' }, 400)
  }

  if (telefono && String(telefono).length > 20) {
    return json({ error: 'El teléfono no puede superar 20 caracteres.' }, 400)
  }

  if (String(mensaje).length > 500) {
    return json({ error: 'El mensaje no puede superar 500 caracteres.' }, 400)
  }

  // Verificar reCAPTCHA
  const captcha = await verificarRecaptcha(recaptchaToken, req)
  if (!captcha.ok) {
    return json({ error: captcha.error }, 403)
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

    // Enviar email al admin (fail-soft: no romper la respuesta si falla)
    const resultadoEmail = await enviarEmailReclamacion({
      comercioId: String(comercioId).trim(),
      nombre: String(nombre).trim(),
      email: emailTrimmed,
      telefono: telefono ? String(telefono).trim() : null,
      mensaje: String(mensaje).trim(),
    })

    if (!resultadoEmail.ok && !resultadoEmail.skipped) {
      console.error('Fallo al enviar email de notificación, pero la solicitud se guardó')
    }

    return json({ ok: true }, 201)
  } catch (error) {
    console.error('Error al registrar solicitud de reclamación:', error)
    return json({ error: 'Error en el servidor. Intenta de nuevo.' }, 500)
  }
}
