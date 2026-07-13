// GET /api/admin/sesion — ¿hay sesión válida? Lo usa el frontend al arrancar
// para decidir si muestra el panel o redirige a /admin/login.
import { obtenerSesion } from '../_auth.js'
import { json } from '../_http.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Método no permitido' }, 405)
  }

  let sesion = null
  try {
    sesion = await obtenerSesion(req)
  } catch (error) {
    // Falta ADMIN_JWT_SECRET: sin secreto no hay sesión que valga.
    console.error('Sesión mal configurada:', error.message)
  }

  if (!sesion) return json({ autenticado: false }, 401)

  const { email, nombre, rol, organizacionSlug } = sesion
  return json({
    autenticado: true,
    usuario: { email, nombre, rol, organizacionSlug },
  })
}
