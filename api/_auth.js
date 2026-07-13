// Autenticación del panel de gestión (/admin).
//
// No hay registro público: las credenciales viven en variables de entorno
// (ADMIN_EMAIL, ADMIN_PASSWORD) y la sesión se mantiene con un JWT firmado
// (HMAC-SHA256) guardado en una cookie httpOnly, inaccesible desde JavaScript.
//
// El guion bajo evita que Vercel lo despliegue como endpoint propio.
// Usa WebCrypto (crypto.subtle) para compatibilidad con Edge Runtime.

import { json } from './_http.js'

export const COOKIE_SESION = 'ncv_admin'

/** Duración de la sesión: 8 horas (JWT y cookie caducan a la vez). */
const DURACION_SESION_S = 8 * 60 * 60

const codificar = (obj) => {
  const json = JSON.stringify(obj)
  const encoded = new TextEncoder().encode(json)
  const arr = Array.from(encoded)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/** Compara dos cadenas en tiempo constante (evita filtrar longitudes). */
async function igualSeguro(a, b) {
  const encoder = new TextEncoder()
  const algo = { name: 'SHA-256' }
  const ha = await crypto.subtle.digest(algo, encoder.encode(String(a)))
  const hb = await crypto.subtle.digest(algo, encoder.encode(String(b)))

  const va = new Uint8Array(ha)
  const vb = new Uint8Array(hb)
  if (va.length !== vb.length) return false

  let resultado = 0
  for (let i = 0; i < va.length; i++) {
    resultado |= va[i] ^ vb[i]
  }
  return resultado === 0
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

async function firmar(datos) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secreto()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const firma = await crypto.subtle.sign('HMAC', key, encoder.encode(datos))
  const arr = Array.from(new Uint8Array(firma))
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/** Emite un JWT HS256 con el payload dado. `exp` se añade automáticamente. */
export async function firmarToken(payload) {
  const ahora = Math.floor(Date.now() / 1000)
  const cuerpo = codificar({ ...payload, iat: ahora, exp: ahora + DURACION_SESION_S })
  const cabecera = codificar({ alg: 'HS256', typ: 'JWT' })
  const firma = await firmar(`${cabecera}.${cuerpo}`)
  return `${cabecera}.${cuerpo}.${firma}`
}

/** Verifica firma y caducidad. Devuelve el payload o null si no es válido. */
export async function verificarToken(token) {
  if (typeof token !== 'string') return null

  const partes = token.split('.')
  if (partes.length !== 3) return null

  const [cabecera, cuerpo, firma] = partes
  const esperada = await firmar(`${cabecera}.${cuerpo}`)
  if (firma.length !== esperada.length) return null

  if (!(await igualSeguro(firma, esperada))) return null

  let payload
  try {
    const decoded = atob(cuerpo.replace(/-/g, '+').replace(/_/g, '/'))
    payload = JSON.parse(decoded)
  } catch {
    return null
  }

  if (typeof payload?.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null
  return payload
}

/**
 * Lee una cookie de la petición sin depender de req.cookies (ausente en dev).
 * Acepta tanto la Request de Edge (headers.get) como la req de Node (headers.cookie).
 */
export function leerCookie(req, nombre) {
  const cabecera =
    typeof req.headers?.get === 'function' ? req.headers.get('cookie') : req.headers?.cookie
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

/** Valor de Set-Cookie que abre sesión. Para las Response de Edge. */
export function cookieDeSesion(token) {
  return serializarCookie(token, DURACION_SESION_S)
}

/** Valor de Set-Cookie que caduca la sesión. Para las Response de Edge. */
export function cookieDeBorrado() {
  return serializarCookie('', 0)
}

/**
 * Comprueba las credenciales contra ADMIN_EMAIL / ADMIN_PASSWORD.
 * Siempre ejecuta ambas comparaciones para no revelar cuál falló.
 */
export async function credencialesValidas(email, password) {
  const emailEsperado = process.env.ADMIN_EMAIL
  const passwordEsperada = process.env.ADMIN_PASSWORD
  if (!emailEsperado || !passwordEsperada) {
    throw new Error('Faltan ADMIN_EMAIL y/o ADMIN_PASSWORD en el entorno.')
  }

  const emailOk = await igualSeguro(String(email ?? '').trim().toLowerCase(), emailEsperado.trim().toLowerCase())
  const passwordOk = await igualSeguro(String(password ?? ''), passwordEsperada)
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
export async function credencialesSuperAdminValidas(email, password) {
  const emailEsperado = process.env.SUPER_ADMIN_EMAIL
  const passwordEsperada = process.env.SUPER_ADMIN_PASSWORD
  if (!emailEsperado || !passwordEsperada) return false

  const emailOk = await igualSeguro(String(email ?? '').trim().toLowerCase(), emailEsperado.trim().toLowerCase())
  const passwordOk = await igualSeguro(String(password ?? ''), passwordEsperada)
  return emailOk && passwordOk
}

/**
 * Guarda a usuario hash SHA-256 de una contraseña (sin salt).
 * Retorna el hash en hex.
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(String(password || '')))
  const arr = Array.from(new Uint8Array(hash))
  return arr.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Compara una contraseña contra un hash almacenado en tiempo constante.
 */
export async function passwordCorrecto(password, hash) {
  const calculado = await hashPassword(password)
  if (calculado.length !== hash.length) return false
  return await igualSeguro(calculado, hash)
}

/** Devuelve el payload de la sesión activa, o null si no hay cookie válida. */
export async function obtenerSesion(req) {
  return await verificarToken(leerCookie(req, COOKIE_SESION))
}

/**
 * Guardia para endpoints privados en Node (Serverless, p. ej. imagen.js):
 * si no hay sesión responde 401 y devuelve null; si la hay, devuelve el
 * payload. El llamante debe abortar si es null.
 */
export async function requerirSesion(req, res) {
  const sesion = await obtenerSesion(req)
  if (!sesion) {
    res.status(401).json({ error: 'No autenticado' })
    return null
  }
  return sesion
}

/**
 * Guardia para Edge Functions: devuelve el payload de la sesión, o una
 * Response 401 lista para retornar. El llamante hace
 * `if (resultado instanceof Response) return resultado`.
 * Absorbe el error de configuración (falta ADMIN_JWT_SECRET): sin secreto
 * no hay sesión que valga.
 */
export async function requerirSesionEdge(req) {
  let sesion = null
  try {
    sesion = await obtenerSesion(req)
  } catch (error) {
    console.error('Sesión mal configurada:', error.message)
  }
  if (!sesion) return json({ error: 'No autenticado' }, 401)
  return sesion
}

/**
 * Guardia de superadmin para Edge Functions: devuelve el payload, o una
 * Response 401/403 lista para retornar.
 */
export async function requerirSuperAdminEdge(req) {
  const resultado = await requerirSesionEdge(req)
  if (resultado instanceof Response) return resultado
  if (resultado.rol !== 'superadmin') {
    return json({ error: 'Acceso denegado. Solo superadmin.' }, 403)
  }
  return resultado
}
