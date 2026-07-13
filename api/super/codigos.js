// GET /api/super/codigos — lista todos los códigos de invitación
// POST /api/super/codigos — crea un nuevo código de invitación
import { requerirSuperAdmin } from '../_auth.js'
import { obtenerSql } from '../_db.js'


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

export default async function handler(req, res) {
  const sesion = await requerirSuperAdmin(req, res)
  if (!sesion) return

  try {
    if (req.method === 'GET') {
      return manejarGet(req, res)
    }
    if (req.method === 'POST') {
      return manejarPost(req, res)
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (error) {
    console.error('Error en /api/super/codigos:', error)
    return res.status(503).json({ error: 'No se pudo conectar con la base de datos.' })
  }
}

async function manejarGet(req, res) {
  const { organizacion_id } = req.query

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

  return res.status(200).json({ codigos: conDatos })
}

async function manejarPost(req, res) {
  const { organizacionId, rolConcedido, usosMaximos, expiracion } = req.body || {}

  if (!organizacionId || !UUID_REGEX.test(organizacionId)) {
    return res.status(400).json({ error: 'organizacionId inválido.' })
  }

  if (!rolConcedido || !['admin', 'editor'].includes(rolConcedido)) {
    return res.status(400).json({ error: 'rolConcedido debe ser "admin" o "editor".' })
  }

  const maxUsos = Math.max(1, usosMaximos || 1)

  const sql = obtenerSql()

  // Verificar que la organización existe
  const orgs = await sql`SELECT id FROM organizaciones WHERE id = ${organizacionId}`
  if (orgs.length === 0) {
    return res.status(404).json({ error: 'Organización no encontrada.' })
  }

  const codigo = generarCodigo()
  const expirationDate = expiracion ? new Date(expiracion).toISOString() : null

  const nuevo = await sql`
    INSERT INTO codigos_invitacion (codigo, organizacion_id, rol_concedido, usos_maximos, expira_en, activo)
    VALUES (${codigo}, ${organizacionId}, ${rolConcedido}, ${maxUsos}, ${expirationDate}, true)
    RETURNING id, codigo, organizacion_id, rol_concedido, usos_maximos, usos_actuales, expira_en, activo, creado_en
  `

  if (nuevo.length === 0) {
    return res.status(400).json({ error: 'No se pudo crear el código de invitación.' })
  }

  const c = nuevo[0]
  return res.status(201).json({
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
  })
}
