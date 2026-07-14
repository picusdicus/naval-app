// POST /api/admin/login — login exclusivo del superadmin (credenciales de
// entorno SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD). El login de organizaciones
// vive en /api/login.
import { credencialesSuperAdminValidas, responderConSesion } from '../_auth.js'
import { json, leerJson } from '../_http.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  const { email, password } = await leerJson(req)
  if (!email || !password) {
    return json({ error: 'Introduce tu email y tu contraseña.' }, 400)
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
