// POST /api/registro — { codigo, email, nombre, password }
// Registra una organización validando su código de invitación.
import { obtenerSql } from './_db.js'
import { firmarToken, cookieDeSesion, hashPassword } from './_auth.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from './_http.js'
import { limitar, obtenerIp, respuesta429 } from './_ratelimit.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }
  if (csrfInvalido(req)) return rechazoCsrf()

  // Rate-limit por IP: frena la fuerza bruta de códigos de invitación.
  const limite = await limitar({ clave: `registro:ip:${obtenerIp(req)}`, limite: 10, ventanaS: 60 * 60 })
  if (!limite.ok) return respuesta429(limite.resetEnS)

  const { codigo, email, nombre, password } = await leerJson(req)
  if (!codigo || !email || !nombre || !password) {
    return json({
      error: 'Introduce código de invitación, email, nombre y contraseña.'
    }, 400)
  }

  try {
    const sql = obtenerSql()

    // 1. Validar el código de invitación.
    const codigoRow = await sql`
      SELECT
        c.id,
        c.organizacion_id,
        c.rol_concedido,
        c.usos_maximos,
        c.usos_actuales,
        c.expira_en,
        c.activo,
        c.comercio_id,
        o.slug
      FROM codigos_invitacion c
      JOIN organizaciones o ON o.id = c.organizacion_id
      WHERE LOWER(c.codigo) = LOWER(${codigo.trim()})
    `

    if (codigoRow.length === 0) {
      return json({ error: 'Código de invitación no válido.' }, 404)
    }

    const codigo_inv = codigoRow[0]

    if (!codigo_inv.activo) {
      return json({ error: 'Este código ha sido desactivado.' }, 403)
    }

    if (codigo_inv.expira_en && new Date(codigo_inv.expira_en) < new Date()) {
      return json({ error: 'Este código ha caducado.' }, 403)
    }

    if (codigo_inv.usos_actuales >= codigo_inv.usos_maximos) {
      return json({ error: 'Este código ha alcanzado su límite de usos.' }, 403)
    }

    // 2. Comprobar si el email ya existe.
    const existing = await sql`
      SELECT id FROM usuarios WHERE LOWER(email) = LOWER(${email.trim()})
    `

    if (existing.length > 0) {
      return json({ error: 'Este email ya está registrado.' }, 409)
    }

    // 3. Crear el usuario con la contraseña hash.
    const passwordHash = await hashPassword(password)
    const nuevoUsuario = await sql`
      INSERT INTO usuarios (
        email,
        nombre,
        password_hash,
        rol,
        organizacion_id,
        codigo_invitacion_id,
        activo
      )
      VALUES (
        ${email.trim()},
        ${nombre.trim()},
        ${passwordHash},
        ${codigo_inv.rol_concedido},
        ${codigo_inv.organizacion_id},
        ${codigo_inv.id},
        true
      )
      RETURNING id, email, nombre, rol, organizacion_id
    `

    if (nuevoUsuario.length === 0) {
      return json({ error: 'No se pudo crear el usuario.' }, 500)
    }

    const usuario = nuevoUsuario[0]

    // 4. Si el código lleva comercio_id, vincular la org al comercio
    if (codigo_inv.comercio_id) {
      await sql`
        UPDATE organizaciones
        SET comercio_id = ${codigo_inv.comercio_id}
        WHERE id = ${usuario.organizacion_id}
      `
    }

    // 5. Incrementar el contador de usos del código.
    await sql`
      UPDATE codigos_invitacion
      SET usos_actuales = usos_actuales + 1
      WHERE id = ${codigo_inv.id}
    `

    // 6. Emitir JWT con el rol incluido.
    const token = await firmarToken({
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      organizacionSlug: codigo_inv.slug,
    })

    return json({
      usuario: {
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        organizacionSlug: codigo_inv.slug,
      },
    }, 201, { 'Set-Cookie': cookieDeSesion(token) })
  } catch (error) {
    console.error('Error en registro:', error)
    return json({ error: 'Error en el servidor durante el registro.' }, 500)
  }
}
