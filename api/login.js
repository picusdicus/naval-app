// POST /api/login — login de usuarios de organización (admin/editor):
// primero el admin de entorno (single-tenant), luego la tabla `usuarios`. El
// login del superadmin vive en /api/admin/login.
import { credencialesValidas, usuarioDeEntorno, passwordCorrecto, necesitaRehash, hashPassword, responderConSesion } from './_auth.js'
import { obtenerSql } from './_db.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from './_http.js'
import { limitar, obtenerIp, respuesta429 } from './_ratelimit.js'

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

  // Rate-limit antes de comprobar credenciales (y antes del PBKDF2, que consume
  // CPU): frena la fuerza bruta por IP y por email.
  const ip = obtenerIp(req)
  const emailNorm = String(email).trim().toLowerCase()
  for (const clave of [`login:ip:${ip}`, `login:email:${emailNorm}`]) {
    const limite = await limitar({ clave, limite: 5, ventanaS: 15 * 60 })
    if (!limite.ok) return respuesta429(limite.resetEnS)
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
        // Rehash transparente: si el hash es del formato antiguo (SHA-256) o usa
        // menos iteraciones, lo actualizamos a PBKDF2 aprovechando que aquí
        // tenemos la contraseña en claro. Un fallo no debe impedir el login.
        if (necesitaRehash(usuario.password_hash)) {
          try {
            const nuevoHash = await hashPassword(password)
            await sql`UPDATE usuarios SET password_hash = ${nuevoHash} WHERE id = ${usuario.id}`
          } catch (error) {
            console.error('No se pudo re-hashear la contraseña:', error)
          }
        }

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
