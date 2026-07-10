// Autenticación del panel de gestión (/admin).
//
// No hay registro público: las credenciales viven en variables de entorno
// (ADMIN_EMAIL, ADMIN_PASSWORD) y la sesión se mantiene con un JWT firmado
// (HMAC-SHA256) guardado en una cookie httpOnly, inaccesible desde JavaScript.
//
// El guion bajo evita que Vercel lo despliegue como endpoint propio.
import { createHmac, timingSafeEqual, createHash } from 'node:crypto'

export const COOKIE_SESION = 'ncv_admin'

/** Duración de la sesión: 8 horas (JWT y cookie caducan a la vez). */
const DURACION_SESION_S = 8 * 60 * 60

const codificar = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')

/** Compara dos cadenas en tiempo constante (evita filtrar longitudes). */
function igualSeguro(a, b) {
  const ha = createHash('sha256').update(String(a)).digest()
  const hb = createHash('sha256').update(String(b)).digest()
  return timingSafeEqual(ha, hb)
}

function secreto() {
  const valor = process.env.ADMIN_JWT_SECRET
  if (!valor || valor.length < 32) {
    throw new Error(
      'Falta ADMIN_JWT_SECRET (mínimo 32 caracteres). Genéralo con: openssl rand -base64 48'
    )
  }
  return valor
}

const firmar = (datos) => createHmac('sha256', secreto()).update(datos).digest('base64url')

/** Emite un JWT HS256 con el payload dado. `exp` se añade automáticamente. */
export function firmarToken(payload) {
  const ahora = Math.floor(Date.now() / 1000)
  const cuerpo = codificar({ ...payload, iat: ahora, exp: ahora + DURACION_SESION_S })
  const cabecera = codificar({ alg: 'HS256', typ: 'JWT' })
  return `${cabecera}.${cuerpo}.${firmar(`${cabecera}.${cuerpo}`)}`
}

/** Verifica firma y caducidad. Devuelve el payload o null si no es válido. */
export function verificarToken(token) {
  if (typeof token !== 'string') return null

  const partes = token.split('.')
  if (partes.length !== 3) return null

  const [cabecera, cuerpo, firma] = partes
  const esperada = firmar(`${cabecera}.${cuerpo}`)
  if (firma.length !== esperada.length) return null
  if (!timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null

  let payload
  try {
    payload = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (typeof payload?.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null
  return payload
}

/** Lee una cookie de la petición sin depender de req.cookies (ausente en dev). */
export function leerCookie(req, nombre) {
  const cabecera = req.headers?.cookie
  if (!cabecera) return null

  for (const trozo of cabecera.split(';')) {
    const sep = trozo.indexOf('=')
    if (sep === -1) continue
    if (trozo.slice(0, sep).trim() === nombre) {
      return decodeURIComponent(trozo.slice(sep + 1).trim())
    }
  }
  return null
}

const enProduccion = () =>
  process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'

function serializarCookie(valor, maxEdad) {
  const partes = [
    `${COOKIE_SESION}=${encodeURIComponent(valor)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxEdad}`,
  ]
  // Sin HTTPS en `npm run dev`, así que Secure solo en despliegue.
  if (enProduccion()) partes.push('Secure')
  return partes.join('; ')
}

export function establecerCookieSesion(res, token) {
  res.setHeader('Set-Cookie', serializarCookie(token, DURACION_SESION_S))
}

export function borrarCookieSesion(res) {
  res.setHeader('Set-Cookie', serializarCookie('', 0))
}

/**
 * Comprueba las credenciales contra ADMIN_EMAIL / ADMIN_PASSWORD.
 * Siempre ejecuta ambas comparaciones para no revelar cuál falló.
 */
export function credencialesValidas(email, password) {
  const emailEsperado = process.env.ADMIN_EMAIL
  const passwordEsperada = process.env.ADMIN_PASSWORD
  if (!emailEsperado || !passwordEsperada) {
    throw new Error('Faltan ADMIN_EMAIL y/o ADMIN_PASSWORD en el entorno.')
  }

  const emailOk = igualSeguro(String(email ?? '').trim().toLowerCase(), emailEsperado.trim().toLowerCase())
  const passwordOk = igualSeguro(String(password ?? ''), passwordEsperada)
  return emailOk && passwordOk
}

/** Datos públicos de la sesión que el frontend puede mostrar. */
export function usuarioDeEntorno() {
  return {
    email: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    nombre: process.env.ADMIN_NOMBRE || 'Gestor',
    rol: 'admin',
    organizacionSlug: process.env.ADMIN_ORG_SLUG || 'tyl-tyl',
  }
}

/**
 * Verifica credenciales de superadmin contra env vars.
 * Devuelve true si ambas coinciden, false si no.
 */
export function credencialesSuperAdminValidas(email, password) {
  const emailEsperado = process.env.SUPER_ADMIN_EMAIL
  const passwordEsperada = process.env.SUPER_ADMIN_PASSWORD
  if (!emailEsperado || !passwordEsperada) return false

  const emailOk = igualSeguro(String(email ?? '').trim().toLowerCase(), emailEsperado.trim().toLowerCase())
  const passwordOk = igualSeguro(String(password ?? ''), passwordEsperada)
  return emailOk && passwordOk
}

/**
 * Guarda a usuario hash SHA-256 de una contraseña (sin salt).
 * Retorna el hash en hex.
 */
export function hashPassword(password) {
  return createHash('sha256').update(String(password || '')).digest('hex')
}

/**
 * Compara una contraseña contra un hash almacenado en tiempo constante.
 */
export function passwordCorrecto(password, hash) {
  const calculado = hashPassword(password)
  if (calculado.length !== hash.length) return false
  return timingSafeEqual(Buffer.from(calculado), Buffer.from(hash))
}

/** Devuelve el payload de la sesión activa, o null si no hay cookie válida. */
export function obtenerSesion(req) {
  return verificarToken(leerCookie(req, COOKIE_SESION))
}

/**
 * Guardia para endpoints privados: si no hay sesión responde 401 y devuelve
 * null; si la hay, devuelve el payload. El llamante debe abortar si es null.
 */
export function requerirSesion(req, res) {
  const sesion = obtenerSesion(req)
  if (!sesion) {
    res.status(401).json({ error: 'No autenticado' })
    return null
  }
  return sesion
}

/**
 * Guardia para endpoints de superadmin: si no hay sesión o el rol no es
 * superadmin, responde 403 y devuelve null. El llamante debe abortar si es null.
 */
export function requerirSuperAdmin(req, res) {
  const sesion = obtenerSesion(req)
  if (!sesion) {
    res.status(401).json({ error: 'No autenticado' })
    return null
  }
  if (sesion.rol !== 'superadmin') {
    res.status(403).json({ error: 'Acceso denegado. Solo superadmin.' })
    return null
  }
  return sesion
}
