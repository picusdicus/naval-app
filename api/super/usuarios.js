// GET /api/super/usuarios?organizacionId=… — lista los usuarios de una organización
// PATCH /api/super/usuarios?id=… — restablece la contraseña de un usuario
import { requerirSuperAdminEdge, hashPassword } from '../_auth.js'
import { obtenerSql } from '../_db.js'
import { json, leerJson, queryDe, csrfInvalido, rechazoCsrf } from '../_http.js'

export const config = { runtime: 'edge' }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Mismo mínimo que exige /registro al crear la cuenta.
const PASSWORD_MIN = 8

export default async function handler(req) {
  if (csrfInvalido(req)) return rechazoCsrf()

  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  try {
    if (req.method === 'GET') {
      return await manejarGet(req)
    }
    if (req.method === 'PATCH') {
      return await manejarPatch(req)
    }

    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/super/usuarios:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}

async function manejarGet(req) {
  const { organizacionId } = queryDe(req)

  if (!organizacionId || !UUID_REGEX.test(organizacionId)) {
    return json({ error: 'ID de organización inválido.' }, 400)
  }

  const sql = obtenerSql()
  const usuarios = await sql`
    SELECT id, email, nombre, rol, activo
    FROM usuarios
    WHERE organizacion_id = ${organizacionId}
    ORDER BY creado_en
  `

  return json({ usuarios })
}

async function manejarPatch(req) {
  const { id } = queryDe(req)
  const { password } = await leerJson(req)

  if (!id || !UUID_REGEX.test(id)) {
    return json({ error: 'ID inválido.' }, 400)
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    return json({ error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.` }, 400)
  }

  const sql = obtenerSql()
  const passwordHash = await hashPassword(password)

  // Solo cuentas de organización: las filas vecino/superadmin (sin
  // organizacion_id) quedan fuera del alcance de este endpoint.
  const actualizado = await sql`
    UPDATE usuarios
    SET password_hash = ${passwordHash}
    WHERE id = ${id} AND organizacion_id IS NOT NULL
    RETURNING id, email
  `

  if (actualizado.length === 0) {
    return json({ error: 'Usuario no encontrado.' }, 404)
  }

  return json({ usuario: actualizado[0] })
}
