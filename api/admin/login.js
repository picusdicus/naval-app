// POST /api/admin/login — login exclusivo del superadmin (credenciales de
// entorno SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD). El login de organizaciones
// vive en /api/login.
import { credencialesSuperAdminValidas, responderConSesion } from '../_auth.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from '../_http.js'
import { limitar, obtenerIp, respuesta429 } from '../_ratelimit.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }
  if (csrfInvalido(req)) return rechazoCsrf()

  const { email, password } = await leerJson(req)
  if (!email || !password) {
    return json({ error: 'Introduce tu email y tu contraseña.' }, 400)
  }

  // Rate-limit del acceso de superadmin (por IP y por email).
  const ip = obtenerIp(req)
  const emailNorm = String(email).trim().toLowerCase()
  for (const clave of [`adminlogin:ip:${ip}`, `adminlogin:email:${emailNorm}`]) {
    const limite = await limitar({ clave, limite: 5, ventanaS: 15 * 60 })
    if (!limite.ok) return respuesta429(limite.resetEnS)
  }

  try {
    if (await credencialesSuperAdminValidas(email, password)) {
      const usuario = {
        email: (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase(),
        nombre: process.env.SUPER_ADMIN_NOMBRE || 'Superadmin',
        rol: 'superadmin',
      }
      return await responderConSesion(usuario)
    }
  } catch (error) {
    console.error('Error checking superadmin credentials:', error)
  }

  return json({ error: 'Email o contraseña incorrectos.' }, 401)
}
