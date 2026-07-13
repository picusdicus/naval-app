// POST /api/admin/registro — { codigo, email, nombre, password }
// Registra una organización validando su código de invitación.
import { obtenerSql } from '../_db.js'
import { firmarToken, establecerCookieSesion, hashPassword } from '../_auth.js'


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { codigo, email, nombre, password } = req.body || {}
  if (!codigo || !email || !nombre || !password) {
    return res.status(400).json({
      error: 'Introduce código de invitación, email, nombre y contraseña.'
    })
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
        o.slug
      FROM codigos_invitacion c
      JOIN organizaciones o ON o.id = c.organizacion_id
      WHERE LOWER(c.codigo) = LOWER(${codigo.trim()})
    `

    if (codigoRow.length === 0) {
      return res.status(404).json({ error: 'Código de invitación no válido.' })
    }

    const codigo_inv = codigoRow[0]

    if (!codigo_inv.activo) {
      return res.status(403).json({ error: 'Este código ha sido desactivado.' })
    }

    if (codigo_inv.expira_en && new Date(codigo_inv.expira_en) < new Date()) {
      return res.status(403).json({ error: 'Este código ha caducado.' })
    }

    if (codigo_inv.usos_actuales >= codigo_inv.usos_maximos) {
      return res.status(403).json({ error: 'Este código ha alcanzado su límite de usos.' })
    }

    // 2. Comprobar si el email ya existe.
    const existing = await sql`
      SELECT id FROM usuarios WHERE LOWER(email) = LOWER(${email.trim()})
    `

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Este email ya está registrado.' })
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
      return res.status(500).json({ error: 'No se pudo crear el usuario.' })
    }

    const usuario = nuevoUsuario[0]

    // 4. Incrementar el contador de usos del código.
    await sql`
      UPDATE codigos_invitacion
      SET usos_actuales = usos_actuales + 1
      WHERE id = ${codigo_inv.id}
    `

    // 5. Emitir JWT con el rol incluido.
    const token = await firmarToken({
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      organizacionSlug: codigo_inv.slug,
    })

    establecerCookieSesion(res, token)

    return res.status(201).json({
      usuario: {
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        organizacionSlug: codigo_inv.slug,
      },
    })
  } catch (error) {
    console.error('Error en registro:', error)
    return res.status(500).json({ error: 'Error en el servidor durante el registro.' })
  }
}
