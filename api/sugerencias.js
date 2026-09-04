// Endpoint para recibir sugerencias, ideas, eventos y altas de comercios desde la sección pública.
//
//   POST /api/sugerencias  { tipo, ...datos, recaptchaToken }  → procesa y acepta la sugerencia
//                                                                (por ahora en dev se simula; en prod
//                                                                enviará email o guardará en DB)

import { json, leerJson, csrfInvalido, rechazoCsrf } from './_http.js'
import { limitar, obtenerIp, respuesta429 } from './_ratelimit.js'

export const config = { runtime: 'edge' }

const TIPOS_VALIDOS = ['idea', 'evento', 'comercio', 'error']
const RECAPTCHA_THRESHOLD = 0.5 // Score mínimo (0.0-1.0) para considerar humano

/**
 * Verifica el token de reCAPTCHA v3 con los servidores de Google.
 * Devuelve { valido: true, score } si es válido, { valido: false } si no.
 */
async function verificarRecaptcha(token, host) {
  if (!token) return { valido: false, razon: 'Token ausente' }

  // useRecaptcha.js genera a propósito un token simulado 'token_<timestamp>'
  // en localhost (y si el script de Google no carga): sin este bypass, ese
  // token se reenviaba tal cual a Google, que lo rechazaba siempre, y el
  // formulario nunca se podía probar en local. Mismo patrón que
  // api/solicitar-reclamacion.js y api/solicitar-alta-comercio.js.
  const esLocalhost = host?.includes('localhost') || host?.includes('127.0.0.1')
  if (esLocalhost) return { valido: true }
  if (token?.startsWith('token_')) return { valido: true }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY
  if (!secretKey) {
    console.warn('[recaptcha] Clave secreta no configurada (RECAPTCHA_SECRET_KEY)')
    return { valido: true }
  }

  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
    })

    const resultado = await res.json()

    if (!resultado.success) {
      return { valido: false, razon: resultado['error-codes']?.join(', ') || 'Token inválido' }
    }

    const score = resultado.score ?? 0
    const esHumano = score >= RECAPTCHA_THRESHOLD

    if (!esHumano) {
      console.warn(`[recaptcha] Score bajo: ${score} (umbral: ${RECAPTCHA_THRESHOLD})`)
    }

    return { valido: esHumano, score }
  } catch (err) {
    console.error('[recaptcha] Error verificando token:', err.message)
    return { valido: false, razon: 'Error al verificar reCAPTCHA' }
  }
}

export default async function handler(req) {
  if (csrfInvalido(req)) return rechazoCsrf()

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  const datos = await leerJson(req)

  // Validar reCAPTCHA v3 primero (caro pero importante)
  const { recaptchaToken } = datos
  const host = typeof req.headers?.get === 'function' ? req.headers.get('host') : req.headers?.host
  const recaptchaValido = await verificarRecaptcha(recaptchaToken, host)
  if (!recaptchaValido.valido) {
    return json(
      { error: 'Verificación de seguridad fallida. No pareces ser humano.' },
      403
    )
  }

  // Rate-limit por IP: máx 5 sugerencias por hora para evitar spam
  const ip = obtenerIp(req)
  const limite = await limitar({ clave: `sugerencias:ip:${ip}`, limite: 5, ventanaS: 60 * 60 })
  if (!limite.ok) return respuesta429(limite.resetEnS)

  // Validar tipo
  const { tipo } = datos
  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return json({ error: 'Tipo de sugerencia no válido' }, 400)
  }

  // Validaciones específicas por tipo
  if (tipo === 'comercio') {
    // OJO: `tipo` ya es el discriminador de la sugerencia ('comercio'), no la
    // categoría del negocio — esa viaja en `tipoNegocio` (SugerirComercio.jsx
    // la manda como datos.categoria). Desestructurar `tipo: tipoNegocio` aquí
    // leía siempre 'comercio' y perdía la categoría real elegida en el form.
    const { nombre, direccion, tipoNegocio } = datos
    if (!nombre?.trim()) return json({ error: 'El nombre es obligatorio' }, 400)
    if (!direccion?.trim()) return json({ error: 'La dirección es obligatoria' }, 400)
    if (!tipoNegocio) return json({ error: 'El tipo de negocio es obligatorio' }, 400)
  } else {
    const { titulo } = datos
    if (!titulo?.trim()) return json({ error: 'El título es obligatorio' }, 400)
  }

  // TODO: En producción:
  // - Guardar en base de datos (tabla `sugerencias`)
  // - O enviar email a admin
  // - O integrar con servicio de formularios externo (Formspree, etc.)

  console.log(`[sugerencias] ${tipo} recibida:`, {
    tipo,
    ip,
    timestamp: new Date().toISOString(),
    datos: {
      titulo: datos.titulo,
      nombre: datos.nombre,
      tipo: datos.tipo,
    },
  })

  return json({ ok: true, mensaje: 'Sugerencia recibida correctamente' }, 200)
}
