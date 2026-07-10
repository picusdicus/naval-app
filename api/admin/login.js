// POST /api/admin/login — { email, password } → cookie httpOnly con el JWT.
import { credencialesValidas, credencialesSuperAdminValidas, firmarToken, establecerCookieSesion, usuarioDeEntorno, passwordCorrecto } from '../_auth.js'
import { obtenerSql } from '../_db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Introduce tu email y tu contraseña.' })
  }

  // Intentar superadmin primero (env vars).
  try {
    if (credencialesSuperAdminValidas(email, password)) {
      const usuario = {
        email: (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase(),
        nombre: process.env.SUPER_ADMIN_NOMBRE || 'Superadmin',
        rol: 'superadmin',
      }
      try {
        establecerCookieSesion(res, firmarToken(usuario))
        return res.status(200).json({ usuario })
      } catch (error) {
        console.error('Login mal configurado:', error.message)
        return res.status(500).json({ error: 'El acceso no está configurado en el servidor.' })
      }
    }
  } catch (error) {
    console.error('Error checking superadmin credentials:', error)
  }

  // Intentar credenciales de entorno (usuario admin de la app).
  try {
    if (credencialesValidas(email, password)) {
      const usuario = usuarioDeEntorno()
      try {
        establecerCookieSesion(res, firmarToken(usuario))
        return res.status(200).json({ usuario })
      } catch (error) {
        console.error('Login mal configurado:', error.message)
        return res.status(500).json({ error: 'El acceso no está configurado en el servidor.' })
      }
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
      if (usuario.password_hash && passwordCorrecto(password, usuario.password_hash)) {
        // Obtener el slug de la organización.
        let slug = null
        if (usuario.organizacion_id) {
          const orgs = await sql`
            SELECT slug FROM organizaciones WHERE id = ${usuario.organizacion_id}
          `
          if (orgs.length > 0) slug = orgs[0].slug
        }

        const payload = {
          email: usuario.email,
          nombre: usuario.nombre,
          rol: usuario.rol,
        }
        if (slug) payload.organizacionSlug = slug

        try {
          establecerCookieSesion(res, firmarToken(payload))
          return res.status(200).json({
            usuario: {
              email: usuario.email,
              nombre: usuario.nombre,
              rol: usuario.rol,
              ...(slug && { organizacionSlug: slug }),
            },
          })
        } catch (error) {
          console.error('Login mal configurado:', error.message)
          return res.status(500).json({ error: 'El acceso no está configurado en el servidor.' })
        }
      }
    }
  } catch (error) {
    console.error('Error en login:', error)
  }

  // Credenciales inválidas.
  return res.status(401).json({ error: 'Email o contraseña incorrectos.' })
}
