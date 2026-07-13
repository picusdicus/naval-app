// GET /api/admin/sesion — ¿hay sesión válida? Lo usa el frontend al arrancar
// para decidir si muestra el panel o redirige a /admin/login.
import { obtenerSesion } from '../_auth.js'


export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  let sesion = null
  try {
    sesion = await obtenerSesion(req)
  } catch (error) {
    // Falta ADMIN_JWT_SECRET: sin secreto no hay sesión que valga.
    console.error('Sesión mal configurada:', error.message)
  }

  if (!sesion) return res.status(401).json({ autenticado: false })

  const { email, nombre, rol, organizacionSlug } = sesion
  return res.status(200).json({
    autenticado: true,
    usuario: { email, nombre, rol, organizacionSlug },
  })
}
