// GET /api/super/codigos — lista todos los códigos de invitación
// POST /api/super/codigos — crea un nuevo código de invitación
import { requerirSuperAdminEdge } from '../_auth.js'
import { obtenerSql } from '../_db.js'
import { json, leerJson, queryDe } from '../_http.js'

export const config = { runtime: 'edge' }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function generarCodigo() {
  const arr = new Uint8Array(8)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function calcularEstado(codigo) {
  if (!codigo.activo) return 'inactivo'
  if (codigo.expira_en && new Date(codigo.expira_en) < new Date()) return 'caducado'
  if (codigo.usos_actuales >= codigo.usos_maximos) return 'agotado'
  return 'activo'
}

export default async function handler(req) {
  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  try {
    if (req.method === 'GET') {
      return await manejarGet(req)
    }
    if (req.method === 'POST') {
      return await manejarPost(req)
    }

    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/super/codigos:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}

async function manejarGet(req) {
  const { organizacion_id } = queryDe(req)

  const sql = obtenerSql()

  let codigos
  if (organizacion_id && UUID_REGEX.test(organizacion_id)) {
    codigos = await sql`
      SELECT
        id,
        codigo,
        organizacion_id,
        rol_concedido,
        usos_maximos,
        usos_actuales,
        expira_en,
        activo,
        creado_en
      FROM codigos_invitacion
      WHERE organizacion_id = ${organizacion_id}
      ORDER BY creado_en DESC
    `
  } else {
    codigos = await sql`
      SELECT
        id,
        codigo,
        organizacion_id,
        rol_concedido,
        usos_maximos,
        usos_actuales,
        expira_en,
        activo,
        creado_en
      FROM codigos_invitacion
      ORDER BY creado_en DESC
    `
  }

  const conDatos = codigos.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    organizacionId: c.organizacion_id,
    rolConcedido: c.rol_concedido,
    usosMaximos: c.usos_maximos,
    usosActuales: c.usos_actuales,
    expiracion: c.expira_en,
    activo: c.activo,
    estado: calcularEstado(c),
    creadoEn: c.creado_en,
  }))

  return json({ codigos: conDatos })
}

async function manejarPost(req) {
  const { organizacionId, rolConcedido, usosMaximos, expiracion } = await leerJson(req)

  if (!organizacionId || !UUID_REGEX.test(organizacionId)) {
    return json({ error: 'organizacionId inválido.' }, 400)
  }

  if (!rolConcedido || !['admin', 'editor'].includes(rolConcedido)) {
    return json({ error: 'rolConcedido debe ser "admin" o "editor".' }, 400)
  }

  const maxUsos = Math.max(1, usosMaximos || 1)

  const sql = obtenerSql()

  // Verificar que la organización existe
  const orgs = await sql`SELECT id FROM organizaciones WHERE id = ${organizacionId}`
  if (orgs.length === 0) {
    return json({ error: 'Organización no encontrada.' }, 404)
  }

  const codigo = generarCodigo()
  const expirationDate = expiracion ? new Date(expiracion).toISOString() : null

  const nuevo = await sql`
    INSERT INTO codigos_invitacion (codigo, organizacion_id, rol_concedido, usos_maximos, expira_en, activo)
    VALUES (${codigo}, ${organizacionId}, ${rolConcedido}, ${maxUsos}, ${expirationDate}, true)
    RETURNING id, codigo, organizacion_id, rol_concedido, usos_maximos, usos_actuales, expira_en, activo, creado_en
  `

  if (nuevo.length === 0) {
    return json({ error: 'No se pudo crear el código de invitación.' }, 400)
  }

  const c = nuevo[0]
  return json({
    codigo: {
      id: c.id,
      codigo: c.codigo,
      organizacionId: c.organizacion_id,
      rolConcedido: c.rol_concedido,
      usosMaximos: c.usos_maximos,
      usosActuales: c.usos_actuales,
      expiracion: c.expira_en,
      activo: c.activo,
      estado: calcularEstado(c),
      creadoEn: c.creado_en,
    },
  }, 201)
}
