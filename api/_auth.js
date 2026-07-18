// Autenticación del panel de gestión (/admin).
//
// No hay registro público: las credenciales viven en variables de entorno
// (ADMIN_EMAIL, ADMIN_PASSWORD) y la sesión se mantiene con un JWT firmado
// (HMAC-SHA256) guardado en una cookie httpOnly, inaccesible desde JavaScript.
//
// El guion bajo evita que Vercel lo despliegue como endpoint propio.
// Usa WebCrypto (crypto.subtle) para compatibilidad con Edge Runtime.

import { json } from './_http.js'

// Nombres base de las cookies. En producción llevan el prefijo `__Host-`, que
// obliga al navegador a exigir Secure + Path=/ + sin Domain (el binding más
// estricto). En `npm run dev` (http, sin Secure) ese prefijo invalidaría la
// cookie, así que se usa el nombre pelado. Emisor y lector deben pasar SIEMPRE
// por estas funciones para no desincronizarse.
const enProduccion = () =>
  process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'

/** Nombre de la cookie de sesión de gestión (panel /admin y /panel). */
export function nombreCookieAdmin() {
  return enProduccion() ? '__Host-ncv_admin' : 'ncv_admin'
}

/** Nombre de la cookie del candado del portal vecinal. */
export function nombreCookiePortal() {
  return enProduccion() ? '__Host-ncv_portal' : 'ncv_portal'
}

/** Duración de la sesión de gestión: 8 horas (JWT y cookie caducan a la vez). */
const DURACION_SESION_S = 8 * 60 * 60

/** Duración del candado del portal: 30 días (los vecinos no re-teclean a diario). */
const DURACION_PORTAL_S = 30 * 24 * 60 * 60

const codificar = (obj) => {
  const json = JSON.stringify(obj)
  const encoded = new TextEncoder().encode(json)
  const arr = Array.from(encoded)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/** Compara dos cadenas en tiempo constante (evita filtrar longitudes). */
export async function igualSeguro(a, b) {
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
export async function firmarToken(payload, duracionS = DURACION_SESION_S) {
  const ahora = Math.floor(Date.now() / 1000)
  const cuerpo = codificar({ ...payload, iat: ahora, exp: ahora + duracionS })
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

function serializarCookie(nombre, valor, maxEdad, sameSite = 'Lax') {
  const partes = [
    `${nombre}=${encodeURIComponent(valor)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    `Max-Age=${maxEdad}`,
  ]
  // Sin HTTPS en `npm run dev`, así que Secure solo en despliegue. Es también
  // lo que permite el prefijo `__Host-` de los nombres de cookie en producción.
  if (enProduccion()) partes.push('Secure')
  return partes.join('; ')
}

/**
 * Cookie de sesión de gestión. SameSite=Strict: el panel es de un solo origen y
 * no necesita sobrevivir a navegaciones cross-site, así que apretamos el CSRF.
 */
export function cookieDeSesion(token) {
  return serializarCookie(nombreCookieAdmin(), token, DURACION_SESION_S, 'Strict')
}

/** Valor de Set-Cookie que caduca la sesión de gestión. */
export function cookieDeBorrado() {
  return serializarCookie(nombreCookieAdmin(), '', 0, 'Strict')
}

/**
 * Cookie del candado del portal vecinal. SameSite=Lax: debe sobrevivir a que un
 * vecino llegue desde un enlace externo (WhatsApp, buscador) sin re-teclear.
 */
export function cookieDePortal(token) {
  return serializarCookie(nombreCookiePortal(), token, DURACION_PORTAL_S, 'Lax')
}

/** Valor de Set-Cookie que caduca el candado del portal. */
export function cookieDeBorradoPortal() {
  return serializarCookie(nombreCookiePortal(), '', 0, 'Lax')
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

// Iteraciones objetivo de PBKDF2-SHA256 (recomendación OWASP). Subirlas obliga
// a re-hashear en el siguiente login (ver necesitaRehash).
const PBKDF2_ITERACIONES = 310000

/** base64 estándar de un Uint8Array (se guarda en la BD, no en URL). */
function bytesAB64(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** Uint8Array desde base64 estándar. */
function b64ABytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Deriva 256 bits con PBKDF2-SHA256 a partir de contraseña, salt e iteraciones. */
async function derivarPbkdf2(password, salt, iteraciones) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password || '')),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iteraciones },
    key,
    256
  )
  return new Uint8Array(bits)
}

/** SHA-256 hex sin salt: solo para verificar hashes del formato antiguo. */
async function sha256Hex(password) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(password || '')))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Hashea una contraseña con PBKDF2 (salt aleatorio de 16 bytes).
 * Formato almacenado: `pbkdf2$<iteraciones>$<saltB64>$<hashB64>`.
 */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derivado = await derivarPbkdf2(password, salt, PBKDF2_ITERACIONES)
  return `pbkdf2$${PBKDF2_ITERACIONES}$${bytesAB64(salt)}$${bytesAB64(derivado)}`
}

/**
 * Compara una contraseña contra un hash almacenado, en tiempo constante.
 * Acepta el formato nuevo (`pbkdf2$…`) y el antiguo (SHA-256 hex de 64 chars),
 * para no invalidar a los usuarios registrados antes de la migración.
 */
export async function passwordCorrecto(password, hashAlmacenado) {
  if (typeof hashAlmacenado !== 'string' || !hashAlmacenado) return false

  if (hashAlmacenado.startsWith('pbkdf2$')) {
    const partes = hashAlmacenado.split('$')
    if (partes.length !== 4) return false
    const iteraciones = Number(partes[1])
    if (!Number.isInteger(iteraciones) || iteraciones < 1) return false
    let salt
    try {
      salt = b64ABytes(partes[2])
    } catch {
      return false
    }
    const derivado = await derivarPbkdf2(password, salt, iteraciones)
    return await igualSeguro(bytesAB64(derivado), partes[3])
  }

  // Formato antiguo: SHA-256 hex sin salt.
  if (/^[0-9a-f]{64}$/i.test(hashAlmacenado)) {
    return await igualSeguro(await sha256Hex(password), hashAlmacenado)
  }

  return false
}

/**
 * ¿El hash almacenado debería re-hashearse? True si es del formato antiguo o si
 * usa menos iteraciones que el objetivo actual. El llamante (login) re-hashea
 * de forma transparente tras validar la contraseña.
 */
export function necesitaRehash(hashAlmacenado) {
  if (typeof hashAlmacenado !== 'string') return false
  if (!hashAlmacenado.startsWith('pbkdf2$')) return true
  const iteraciones = Number(hashAlmacenado.split('$')[1])
  return !Number.isInteger(iteraciones) || iteraciones < PBKDF2_ITERACIONES
}

/** Devuelve el payload de la sesión de gestión activa, o null si no hay cookie válida. */
export async function obtenerSesion(req) {
  return await verificarToken(leerCookie(req, nombreCookieAdmin()))
}

/**
 * Verifica el candado del portal vecinal. Devuelve el payload si la cookie es
 * válida y su rol es 'vecino', o null. No confundir con las sesiones de gestión.
 */
export async function verificarSesionPortal(req) {
  const payload = await verificarToken(leerCookie(req, nombreCookiePortal()))
  return payload?.rol === 'vecino' ? payload : null
}

/**
 * Respuesta común de los endpoints de login (organización y superadmin):
 * firma el payload, la manda como cookie de sesión y devuelve el usuario en
 * el cuerpo. 500 si falta ADMIN_JWT_SECRET (login mal configurado).
 */
export async function responderConSesion(usuario, payload = usuario, status = 200) {
  try {
    return json({ usuario }, status, { 'Set-Cookie': cookieDeSesion(await firmarToken(payload)) })
  } catch (error) {
    console.error('Login mal configurado:', error.message)
    return json({ error: 'El acceso no está configurado en el servidor.' }, 500)
  }
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
