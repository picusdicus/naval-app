// GET /api/super/organizaciones — lista todas las organizaciones
// POST /api/super/organizaciones — crea una nueva organización
// PUT /api/super/organizaciones?id=… — actualiza una organización
// PATCH /api/super/organizaciones?id=… — activa/desactiva una organización
import { requerirSuperAdminEdge } from '../_auth.js'
import { obtenerSql } from '../_db.js'
import { json, leerJson, queryDe, csrfInvalido, rechazoCsrf } from '../_http.js'

export const config = { runtime: 'edge' }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Ids del directorio de comercios: 'gpl_…' (comercios.json, Google Places) o
// 'local/…' (servicios-locales.json). Solo se valida el formato — el picker
// del panel garantiza que el id existe; importar los JSON aquí sería inflar
// la función Edge sin ganancia.
const COMERCIO_ID_REGEX = /^(gpl_|local\/)/

/** Traduce una violación de UNIQUE (23505) a un 409 con mensaje útil. */
function conflictoUnico(error) {
  if (error?.code !== '23505') return null
  if (String(error.constraint || '').includes('comercio')) {
    return json({ error: 'Ese comercio ya está vinculado a otra organización.' }, 409)
  }
  return json({ error: 'Ya existe una organización con ese slug.' }, 409)
}

export default async function handler(req) {
  if (csrfInvalido(req)) return rechazoCsrf()

  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  try {
    if (req.method === 'GET') {
      return await manejarGet()
    }
    if (req.method === 'POST') {
      return await manejarPost(req)
    }
    if (req.method === 'PUT') {
      return await manejarPut(req)
    }
    if (req.method === 'PATCH') {
      return await manejarPatch(req)
    }

    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/super/organizaciones:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}

async function manejarGet() {
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
      comercio_id,
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
        comercioId: org.comercio_id,
        activa: org.activa,
        creadaEn: org.creada_en,
        usuariosCount: usuarios[0].total,
        eventosCount: eventos[0].total,
        codigosActivosCount: codigos[0].total,
      }
    })
  )

  return json({ organizaciones: conDatos })
}

async function manejarPost(req) {
  const { nombre, slug, descripcion, emailContacto, telefono, web, categoriaDefecto, lugarDefecto, comercioId } = await leerJson(req)

  if (!nombre || !slug) {
    return json({ error: 'Nombre y slug son requeridos.' }, 400)
  }
  if (comercioId && !COMERCIO_ID_REGEX.test(comercioId)) {
    return json({ error: 'Referencia de comercio inválida.' }, 400)
  }

  const sql = obtenerSql()

  let nueva
  try {
    nueva = await sql`
      INSERT INTO organizaciones (nombre, slug, descripcion, email_contacto, telefono, web, categoria_defecto, lugar_defecto, comercio_id, activa)
      VALUES (${nombre}, ${slug}, ${descripcion || null}, ${emailContacto || null}, ${telefono || null}, ${web || null}, ${categoriaDefecto || null}, ${lugarDefecto || null}, ${comercioId || null}, true)
      RETURNING id, nombre, slug, descripcion, email_contacto, telefono, web, categoria_defecto, lugar_defecto, comercio_id, activa, creada_en
    `
  } catch (error) {
    const conflicto = conflictoUnico(error)
    if (conflicto) return conflicto
    throw error
  }

  if (nueva.length === 0) {
    return json({ error: 'No se pudo crear la organización.' }, 400)
  }

  const org = nueva[0]
  return json({
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
      comercioId: org.comercio_id,
      activa: org.activa,
      creadaEn: org.creada_en,
      usuariosCount: 0,
      eventosCount: 0,
      codigosActivosCount: 0,
    },
  }, 201)
}

/** Perfil completo de una organización con sus contadores, para PUT/PATCH. */
async function organizacionConContadores(sql, org) {
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
    comercioId: org.comercio_id,
    activa: org.activa,
    creadaEn: org.creada_en,
    usuariosCount: usuarios[0].total,
    eventosCount: eventos[0].total,
    codigosActivosCount: codigos[0].total,
  }
}

async function manejarPut(req) {
  const { id } = queryDe(req)
  const { nombre, slug, descripcion, emailContacto, telefono, web, categoriaDefecto, lugarDefecto, comercioId } = await leerJson(req)

  if (!id || !UUID_REGEX.test(id)) {
    return json({ error: 'ID inválido.' }, 400)
  }

  if (!nombre || !slug) {
    return json({ error: 'Nombre y slug son requeridos.' }, 400)
  }
  if (comercioId && !COMERCIO_ID_REGEX.test(comercioId)) {
    return json({ error: 'Referencia de comercio inválida.' }, 400)
  }

  const sql = obtenerSql()

  let actualizada
  try {
    actualizada = await sql`
      UPDATE organizaciones
      SET nombre = ${nombre},
          slug = ${slug},
          descripcion = ${descripcion || null},
          email_contacto = ${emailContacto || null},
          telefono = ${telefono || null},
          web = ${web || null},
          categoria_defecto = ${categoriaDefecto || null},
          lugar_defecto = ${lugarDefecto || null},
          comercio_id = ${comercioId || null}
      WHERE id = ${id}
      RETURNING id, nombre, slug, descripcion, email_contacto, telefono, web, categoria_defecto, lugar_defecto, comercio_id, activa, creada_en
    `
  } catch (error) {
    const conflicto = conflictoUnico(error)
    if (conflicto) return conflicto
    throw error
  }

  if (actualizada.length === 0) {
    return json({ error: 'Organización no encontrada.' }, 404)
  }

  return json({ organizacion: await organizacionConContadores(sql, actualizada[0]) })
}

async function manejarPatch(req) {
  const { id } = queryDe(req)
  const { activa } = await leerJson(req)

  if (!id || !UUID_REGEX.test(id)) {
    return json({ error: 'ID inválido.' }, 400)
  }

  if (typeof activa !== 'boolean') {
    return json({ error: 'El campo activa debe ser un booleano.' }, 400)
  }

  const sql = obtenerSql()

  const actualizada = await sql`
    UPDATE organizaciones
    SET activa = ${activa}
    WHERE id = ${id}
    RETURNING id, nombre, slug, descripcion, email_contacto, telefono, web, categoria_defecto, lugar_defecto, comercio_id, activa, creada_en
  `

  if (actualizada.length === 0) {
    return json({ error: 'Organización no encontrada.' }, 404)
  }

  return json({ organizacion: await organizacionConContadores(sql, actualizada[0]) })
}
