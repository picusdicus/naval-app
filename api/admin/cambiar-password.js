// PUT /api/admin/cambiar-password — cambiar la contraseña de la sesión actual
// Soporta tanto admin de entorno como usuarios de BD en organizaciones y superadmin
import { obtenerSesion, credencialesValidas, credencialesSuperAdminValidas, passwordCorrecto, hashPassword } from '../_auth.js'
import { obtenerSql } from '../_db.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from '../_http.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'PUT') {
    return json({ error: 'Método no permitido' }, 405)
  }
  if (csrfInvalido(req)) return rechazoCsrf()

  const sesion = await obtenerSesion(req)
  if (!sesion) return json({ error: 'No autenticado' }, 401)

  const { passwordActual, passwordNueva } = await leerJson(req)
  if (!passwordActual || !passwordNueva) {
    return json({ error: 'Falta la contraseña actual o la nueva.' }, 400)
  }

  if (passwordNueva.length < 8) {
    return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400)
  }

  if (passwordActual === passwordNueva) {
    return json({ error: 'La contraseña nueva debe ser diferente de la actual.' }, 400)
  }

  try {
    const email = sesion.email
    const rol = sesion.rol

    // Si es superadmin (credenciales de entorno)
    if (rol === 'superadmin') {
      const emailEsperado = process.env.SUPER_ADMIN_EMAIL
      const passwordEsperada = process.env.SUPER_ADMIN_PASSWORD
      if (!emailEsperado || !passwordEsperada) {
        return json({ error: 'El superadmin no puede cambiar la contraseña (credenciales de entorno).' }, 403)
      }

      // Validar contraseña actual
      if (!(await credencialesSuperAdminValidas(email, passwordActual))) {
        return json({ error: 'La contraseña actual es incorrecta.' }, 401)
      }

      return json({ error: 'El superadmin usa credenciales de entorno. Contacta al administrador.' }, 403)
    }

    // Si es admin de entorno (ADMIN_EMAIL/ADMIN_PASSWORD)
    const adminEmail = process.env.ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD
    if (adminEmail && adminPassword && email.toLowerCase() === adminEmail.trim().toLowerCase()) {
      if (!(await credencialesValidas(email, passwordActual))) {
        return json({ error: 'La contraseña actual es incorrecta.' }, 401)
      }
      return json({ error: 'El admin usa credenciales de entorno. Contacta al administrador.' }, 403)
    }

    // Si es usuario de BD (organización)
    const sql = obtenerSql()
    const usuarios = await sql`
      SELECT id, password_hash FROM usuarios
      WHERE LOWER(email) = LOWER(${email}) AND activo = true
    `

    if (usuarios.length === 0) {
      return json({ error: 'Usuario no encontrado.' }, 404)
    }

    const usuario = usuarios[0]

    // Validar contraseña actual
    if (!(await passwordCorrecto(passwordActual, usuario.password_hash))) {
      return json({ error: 'La contraseña actual es incorrecta.' }, 401)
    }

    // Hashear y actualizar la nueva contraseña
    const nuevoHash = await hashPassword(passwordNueva)
    await sql`
      UPDATE usuarios
      SET password_hash = ${nuevoHash}
      WHERE id = ${usuario.id}
    `

    return json({ success: true, mensaje: 'Contraseña cambiada exitosamente.' })
  } catch (error) {
    console.error('Error al cambiar contraseña:', error)
    return json({ error: 'No se pudo cambiar la contraseña.' }, 500)
  }
}
