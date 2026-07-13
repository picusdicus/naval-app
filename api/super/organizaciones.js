// GET /api/super/organizaciones — lista todas las organizaciones
// POST /api/super/organizaciones — crea una nueva organización
// PUT /api/super/organizaciones/:id — actualiza una organización
import { requerirSuperAdmin } from '../_auth.js'
import { obtenerSql } from '../_db.js'


const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  const sesion = await requerirSuperAdmin(req, res)
  if (!sesion) return

  try {
    if (req.method === 'GET') {
      return manejarGet(res)
    }
    if (req.method === 'POST') {
      return manejarPost(req, res)
    }
    if (req.method === 'PUT') {
      return manejarPut(req, res)
    }
    if (req.method === 'PATCH') {
      return manejarPatch(req, res)
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (error) {
    console.error('Error en /api/super/organizaciones:', error)
    return res.status(503).json({ error: 'No se pudo conectar con la base de datos.' })
  }
}

async function manejarGet(res) {
  const sql = obtenerSql()
  const orgs = await sql`
    SELECT
      id,
      nombre,
      slug,
      descripcion,
      email_contacto,
      telefono,
      web,
      categoria_defecto,
      lugar_defecto,
      activa,
      creada_en
    FROM organizaciones
    ORDER BY creada_en DESC
  `

  const conDatos = await Promise.all(
    orgs.map(async (org) => {
      const usuarios = await sql`SELECT COUNT(*) as total FROM usuarios WHERE organizacion_id = ${org.id}`
      const eventos = await sql`SELECT COUNT(*) as total FROM eventos_usuario WHERE organizacion_id = ${org.id}`
      const codigos = await sql`SELECT COUNT(*) as total FROM codigos_invitacion WHERE organizacion_id = ${org.id} AND activo = true`

      return {
        id: org.id,
        nombre: org.nombre,
        slug: org.slug,
        descripcion: org.descripcion,
        emailContacto: org.email_contacto,
        telefono: org.telefono,
        web: org.web,
        categoriaDefecto: org.categoria_defecto,
        lugarDefecto: org.lugar_defecto,
        activa: org.activa,
        creadaEn: org.creada_en,
        usuariosCount: usuarios[0].total,
        eventosCount: eventos[0].total,
        codigosActivosCount: codigos[0].total,
      }
    })
  )

  return res.status(200).json({ organizaciones: conDatos })
}

async function manejarPost(req, res) {
  const { nombre, slug, descripcion, emailContacto, telefono, web, categoriaDefecto, lugarDefecto } = req.body || {}

  if (!nombre || !slug) {
    return res.status(400).json({ error: 'Nombre y slug son requeridos.' })
  }

  const sql = obtenerSql()

  const nueva = await sql`
    INSERT INTO organizaciones (nombre, slug, descripcion, email_contacto, telefono, web, categoria_defecto, lugar_defecto, activa)
    VALUES (${nombre}, ${slug}, ${descripcion || null}, ${emailContacto || null}, ${telefono || null}, ${web || null}, ${categoriaDefecto || null}, ${lugarDefecto || null}, true)
    RETURNING id, nombre, slug, descripcion, email_contacto, telefono, web, categoria_defecto, lugar_defecto, activa, creada_en
  `

  if (nueva.length === 0) {
    return res.status(400).json({ error: 'No se pudo crear la organización.' })
  }

  const org = nueva[0]
  return res.status(201).json({
    organizacion: {
      id: org.id,
      nombre: org.nombre,
      slug: org.slug,
      descripcion: org.descripcion,
      emailContacto: org.email_contacto,
      telefono: org.telefono,
      web: org.web,
      categoriaDefecto: org.categoria_defecto,
      lugarDefecto: org.lugar_defecto,
      activa: org.activa,
      creadaEn: org.creada_en,
      usuariosCount: 0,
      eventosCount: 0,
      codigosActivosCount: 0,
    },
  })
}

async function manejarPut(req, res) {
  const { id } = req.query
  const { nombre, slug, descripcion, emailContacto, telefono, web, categoriaDefecto, lugarDefecto } = req.body || {}

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'ID inválido.' })
  }

  if (!nombre || !slug) {
    return res.status(400).json({ error: 'Nombre y slug son requeridos.' })
  }

  const sql = obtenerSql()

  const actualizada = await sql`
    UPDATE organizaciones
    SET nombre = ${nombre},
        slug = ${slug},
        descripcion = ${descripcion || null},
        email_contacto = ${emailContacto || null},
        telefono = ${telefono || null},
        web = ${web || null},
        categoria_defecto = ${categoriaDefecto || null},
        lugar_defecto = ${lugarDefecto || null}
    WHERE id = ${id}
    RETURNING id, nombre, slug, descripcion, email_contacto, telefono, web, categoria_defecto, lugar_defecto, activa, creada_en
  `

  if (actualizada.length === 0) {
    return res.status(404).json({ error: 'Organización no encontrada.' })
  }

  const org = actualizada[0]
  const usuarios = await sql`SELECT COUNT(*) as total FROM usuarios WHERE organizacion_id = ${org.id}`
  const eventos = await sql`SELECT COUNT(*) as total FROM eventos_usuario WHERE organizacion_id = ${org.id}`
  const codigos = await sql`SELECT COUNT(*) as total FROM codigos_invitacion WHERE organizacion_id = ${org.id} AND activo = true`

  return res.status(200).json({
    organizacion: {
      id: org.id,
      nombre: org.nombre,
      slug: org.slug,
      descripcion: org.descripcion,
      emailContacto: org.email_contacto,
      telefono: org.telefono,
      web: org.web,
      categoriaDefecto: org.categoria_defecto,
      lugarDefecto: org.lugar_defecto,
      activa: org.activa,
      creadaEn: org.creada_en,
      usuariosCount: usuarios[0].total,
      eventosCount: eventos[0].total,
      codigosActivosCount: codigos[0].total,
    },
  })
}

async function manejarPatch(req, res) {
  const { id } = req.query
  const { activa } = req.body || {}

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'ID inválido.' })
  }

  if (typeof activa !== 'boolean') {
    return res.status(400).json({ error: 'El campo activa debe ser un booleano.' })
  }

  const sql = obtenerSql()

  const actualizada = await sql`
    UPDATE organizaciones
    SET activa = ${activa}
    WHERE id = ${id}
    RETURNING id, nombre, slug, descripcion, email_contacto, telefono, web, categoria_defecto, lugar_defecto, activa, creada_en
  `

  if (actualizada.length === 0) {
    return res.status(404).json({ error: 'Organización no encontrada.' })
  }

  const org = actualizada[0]
  const usuarios = await sql`SELECT COUNT(*) as total FROM usuarios WHERE organizacion_id = ${org.id}`
  const eventos = await sql`SELECT COUNT(*) as total FROM eventos_usuario WHERE organizacion_id = ${org.id}`
  const codigos = await sql`SELECT COUNT(*) as total FROM codigos_invitacion WHERE organizacion_id = ${org.id} AND activo = true`

  return res.status(200).json({
    organizacion: {
      id: org.id,
      nombre: org.nombre,
      slug: org.slug,
      descripcion: org.descripcion,
      emailContacto: org.email_contacto,
      telefono: org.telefono,
      web: org.web,
      categoriaDefecto: org.categoria_defecto,
      lugarDefecto: org.lugar_defecto,
      activa: org.activa,
      creadaEn: org.creada_en,
      usuariosCount: usuarios[0].total,
      eventosCount: eventos[0].total,
      codigosActivosCount: codigos[0].total,
    },
  })
}
