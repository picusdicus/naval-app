// POST /api/solicitar-alta-comercio — { nombre, categoria, direccion, telefono, notas, recaptchaToken }
// Registra una solicitud anónima de alta de un negocio que todavía no está en
// el directorio (issue #35). El superadmin la revisa en /admin → Altas y, al
// aprobarla, publica la ficha en servicios-locales.json (ver
// api/super/altas-comercio.js). Mismo molde que api/solicitar-reclamacion.js.
import { obtenerSql } from './_db.js'
import { limitar, obtenerIp } from './_ratelimit.js'
import { LISTA_CATEGORIAS } from '../src/lib/categorias.js'
import comercios from '../src/data/comercios.json'
import servicios from '../src/data/servicios-locales.json'

export const config = { runtime: 'nodejs' }

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY
const RECAPTCHA_SCORE_MIN = 0.5
const CATEGORIAS_VALIDAS = new Set(LISTA_CATEGORIAS.map((c) => c.id))

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

  // Si el token es simulado (comienza con 'token_'), es que Google aún no ha validado
  // el dominio en producción. Aceptarlo sin verificar.
  if (token?.startsWith('token_')) {
    console.warn('Token simulado detectado (reCAPTCHA en validación), aceptando')
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

// Normaliza para comparar: minúsculas, sin tildes, espacios colapsados.
function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Heurística barata de duplicado, solo para avisar (no para bloquear del
// todo): si un nombre contiene al otro, o comparten ≥2 palabras de 4+ letras.
function nombresParecidos(a, b) {
  const na = normalizar(a)
  const nb = normalizar(b)
  if (!na || !nb) return false
  if (na.includes(nb) || nb.includes(na)) return true

  const palabrasA = new Set(na.split(' ').filter((w) => w.length >= 4))
  const palabrasB = nb.split(' ').filter((w) => w.length >= 4)
  let comunes = 0
  for (const w of palabrasB) if (palabrasA.has(w)) comunes++
  return comunes >= 2
}

function buscarDuplicado(nombre) {
  for (const c of comercios) {
    if (nombresParecidos(nombre, c.nombre)) return c.nombre
  }
  for (const s of servicios) {
    if (nombresParecidos(nombre, s.nombre)) return s.nombre
  }
  return null
}

export default async function handler(req, res) {
  console.log(`[solicitar-alta-comercio] ${req.method} ${req.url}`)

  if (req.method !== 'POST') {
    return respuestaJson(res, { error: 'Método no permitido' }, 405)
  }

  // En localhost, saltarse el rate-limit para facilitar testing
  const esLocalhost = req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1')
  if (!esLocalhost) {
    const ip = obtenerIp(req)
    const limite = await limitar({ clave: `alta-comercio:ip:${ip}`, limite: 5, ventanaS: 60 * 60 })
    if (!limite.ok) {
      return respuestaJson(res, { error: 'Demasiadas solicitudes. Intenta más tarde.' }, 429)
    }
  }

  const { nombre, categoria, direccion, telefono, notas, recaptchaToken } = req.body || {}
  console.log('[solicitar-alta-comercio] Body:', { nombre, categoria })

  // Validar campos
  if (!nombre || !categoria || !direccion) {
    return respuestaJson(res, { error: 'Faltan campos requeridos.' }, 400)
  }

  if (String(nombre).trim().length === 0 || String(nombre).length > 100) {
    return respuestaJson(res, { error: 'El nombre debe tener entre 1 y 100 caracteres.' }, 400)
  }

  if (!CATEGORIAS_VALIDAS.has(categoria)) {
    return respuestaJson(res, { error: 'Categoría no válida.' }, 400)
  }

  if (String(direccion).trim().length === 0 || String(direccion).length > 200) {
    return respuestaJson(res, { error: 'La dirección debe tener entre 1 y 200 caracteres.' }, 400)
  }

  if (telefono && String(telefono).length > 20) {
    return respuestaJson(res, { error: 'El teléfono no puede superar 20 caracteres.' }, 400)
  }

  if (notas && String(notas).length > 500) {
    return respuestaJson(res, { error: 'Las notas no pueden superar 500 caracteres.' }, 400)
  }

  // Verificar reCAPTCHA
  const captcha = await verificarRecaptcha(recaptchaToken, req.headers.host)
  if (!captcha.ok) {
    return respuestaJson(res, { error: captcha.error }, 403)
  }

  const nombreLimpio = String(nombre).trim()
  const duplicado = buscarDuplicado(nombreLimpio)
  if (duplicado) {
    return respuestaJson(
      res,
      {
        error: `Ya existe un comercio con un nombre parecido: "${duplicado}". Si es un error, indícalo en las notas y vuelve a enviar.`,
      },
      409,
    )
  }

  try {
    const sql = obtenerSql()

    const resultado = await sql`
      INSERT INTO solicitudes_alta_comercio (nombre, categoria, direccion, telefono, notas, estado)
      VALUES (
        ${nombreLimpio},
        ${categoria},
        ${String(direccion).trim()},
        ${telefono ? String(telefono).trim() : null},
        ${notas ? String(notas).trim() : null},
        'pendiente'
      )
      RETURNING id
    `

    const solicitudId = resultado[0].id
    console.log('[solicitar-alta-comercio] Solicitud guardada:', solicitudId)

    return respuestaJson(res, { ok: true, solicitudId }, 201)
  } catch (error) {
    console.error('[solicitar-alta-comercio] Error:', error)
    return respuestaJson(res, { error: 'Error en el servidor. Intenta de nuevo.' }, 500)
  }
}
