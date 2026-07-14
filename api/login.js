// POST /api/login — login de usuarios de organización (admin/editor):
// primero el admin de entorno (single-tenant), luego la tabla `usuarios`. El
// login del superadmin vive en /api/admin/login.
import { credencialesValidas, usuarioDeEntorno, passwordCorrecto, responderConSesion } from './_auth.js'
import { obtenerSql } from './_db.js'
import { json, leerJson } from './_http.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  const { email, password } = await leerJson(req)
  if (!email || !password) {
    return json({ error: 'Introduce tu email y tu contraseña.' }, 400)
  }

  // Intentar credenciales de entorno (usuario admin de la app).
  try {
    if (await credencialesValidas(email, password)) {
      return await responderConSesion(usuarioDeEntorno())
    }
  } catch (error) {
    console.error('Error checking admin credentials:', error)
  }

  // Intentar buscar usuario en la BD con password hash.
  try {
    const sql = obtenerSql()
    const usuarios = await sql`
      SELECT id, email, nombre, password_hash, rol, organizacion_id
      FROM usuarios
      WHERE LOWER(email) = LOWER(${email.trim()}) AND activo = true
    `

    if (usuarios.length > 0) {
      const usuario = usuarios[0]
      if (usuario.password_hash && await passwordCorrecto(password, usuario.password_hash)) {
        // Obtener el slug de la organización.
        let slug = null
        if (usuario.organizacion_id) {
          const orgs = await sql`
            SELECT slug FROM organizaciones WHERE id = ${usuario.organizacion_id}
          `
          if (orgs.length > 0) slug = orgs[0].slug
        }

        const publico = {
          email: usuario.email,
          nombre: usuario.nombre,
          rol: usuario.rol,
          ...(slug && { organizacionSlug: slug }),
        }
        const payload = { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol }
        if (slug) payload.organizacionSlug = slug

        return await responderConSesion(publico, payload)
      }
    }
  } catch (error) {
    console.error('Error en login:', error)
  }

  // Credenciales inválidas.
  return json({ error: 'Email o contraseña incorrectos.' }, 401)
}
