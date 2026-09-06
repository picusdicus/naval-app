// /api/super/eventos-manuales — el superadmin crea eventos a mano desde el tab
// Eventos de /admin, en nombre de cualquier organizador (existente o nuevo).
//
//   GET  — { organizaciones: [{id, nombre, slug}], lugares: [...] } para rellenar
//          los desplegables del formulario: todas las organizaciones activas y
//          los lugares ya usados en eventos_usuario (+ lugar_defecto de las orgs).
//   POST — crea una fila en eventos_usuario. El organizador llega como
//          `organizacionId` (una existente) o como `organizacionNombre` (se crea
//          una organización nueva con slug derivado del nombre; si ese slug ya
//          existe se reutiliza esa organización en vez de duplicarla).
//
// Mismas reglas de validación que el panel de las organizaciones
// (validarEvento en src/lib/eventoForm.js); aquí no manda ningún perfil de
// organización: categoría y lugar los elige el superadmin evento a evento.
// Origen: `origen_externo_id` queda NULL, así el tab Eventos lo etiqueta como
// "Organización" (creado a mano), igual que los del panel.
import { requerirSuperAdminEdge } from '../_auth.js'
import { obtenerSql } from '../_db.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from '../_http.js'
import { validarEvento, normalizarEvento } from '../../src/lib/eventoForm.js'
import { claveNormSlug } from '../../src/lib/dedupEventos.js'

export const config = { runtime: 'edge' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_NOMBRE_ORG = 120

const texto = (v) => String(v ?? '').trim()

async function listarOpciones(sql) {
  const orgs = await sql`
    SELECT id, nombre, slug, lugar_defecto
    FROM organizaciones
    WHERE activa = true
    ORDER BY nombre ASC
  `
  const lugaresUsados = await sql`
    SELECT DISTINCT lugar
    FROM eventos_usuario
    WHERE lugar IS NOT NULL AND lugar <> '' AND ambito = 'navalcarnero'
    ORDER BY lugar ASC
  `
  const lugares = new Set()
  for (const o of orgs) if (texto(o.lugar_defecto)) lugares.add(texto(o.lugar_defecto))
  for (const l of lugaresUsados) lugares.add(texto(l.lugar))

  return json({
    organizaciones: orgs.map((o) => ({ id: o.id, nombre: o.nombre, slug: o.slug })),
    lugares: [...lugares].sort((a, b) => a.localeCompare(b, 'es')),
  })
}

/**
 * Resuelve el organizador del cuerpo: por id (existente) o por nombre (nuevo).
 * Devuelve { organizacion } o { error: Response }.
 */
async function resolverOrganizacion(sql, cuerpo) {
  const id = texto(cuerpo.organizacionId)
  const nombre = texto(cuerpo.organizacionNombre)

  if (id) {
    if (!UUID.test(id)) return { error: json({ error: 'Organizador no válido.' }, 400) }
    const [org] = await sql`SELECT id, nombre, slug FROM organizaciones WHERE id = ${id}`
    if (!org) return { error: json({ error: 'Ese organizador no existe.' }, 404) }
    return { organizacion: org, creada: false }
  }

  if (!nombre) return { error: json({ error: 'Indica el organizador del evento.' }, 400) }
  if (nombre.length > MAX_NOMBRE_ORG) {
    return { error: json({ error: `El nombre del organizador no puede superar ${MAX_NOMBRE_ORG} caracteres.` }, 400) }
  }
  const slug = claveNormSlug(nombre)
  if (!slug) return { error: json({ error: 'El nombre del organizador no es válido.' }, 400) }

  // Si ya hay una organización con ese slug (mismo nombre salvo mayúsculas o
  // acentos), se reutiliza: crear otra sería un duplicado.
  const [existente] = await sql`SELECT id, nombre, slug FROM organizaciones WHERE slug = ${slug}`
  if (existente) return { organizacion: existente, creada: false }

  const [nueva] = await sql`
    INSERT INTO organizaciones (nombre, slug, activa)
    VALUES (${nombre}, ${slug}, true)
    RETURNING id, nombre, slug
  `
  return { organizacion: nueva, creada: true }
}

async function crear(sql, cuerpo) {
  // Solo eventos dentro de Navalcarnero desde esta vía: el superadmin cura la
  // agenda local. El ámbito 'otro' sigue siendo cosa del panel de cada org.
  const evento = { ...cuerpo, ambito: 'navalcarnero', provincia: '', poblacion: '', fechaFin: '' }
  const errores = validarEvento(evento)
  if (Object.keys(errores).length > 0) {
    return json({ error: 'Revisa los campos del formulario.', errores }, 422)
  }

  const resuelto = await resolverOrganizacion(sql, cuerpo)
  if (resuelto.error) return resuelto.error
  const { organizacion, creada } = resuelto

  const e = normalizarEvento(evento)
  const [fila] = await sql`
    INSERT INTO eventos_usuario (
      organizacion_id, titulo, descripcion, categoria, lugar,
      fecha_inicio, hora, hora_fin, imagen_url,
      entradas_texto, entradas_url, precio, estado, ambito, provincia, poblacion
    ) VALUES (
      ${organizacion.id}, ${e.titulo}, ${e.descripcion}, ${e.categoria}, ${e.lugar},
      ${e.fecha}, ${e.hora}, ${e.horaFin}, ${e.imagen},
      ${e.entradasTexto}, ${e.entradasUrl}, ${e.precio}, ${e.estado},
      ${e.ambito}, ${e.provincia}, ${e.poblacion}
    )
    RETURNING id, titulo, estado, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha
  `

  return json(
    {
      evento: { id: fila.id, referenciaId: `bd-${fila.id}`, titulo: fila.titulo, estado: fila.estado, fecha: fila.fecha },
      organizacion: { id: organizacion.id, nombre: organizacion.nombre, slug: organizacion.slug, creada },
    },
    201,
  )
}

export default async function handler(req) {
  if (csrfInvalido(req)) return rechazoCsrf()

  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  try {
    const sql = obtenerSql()
    if (req.method === 'GET') return await listarOpciones(sql)
    if (req.method === 'POST') return await crear(sql, await leerJson(req))
    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/super/eventos-manuales:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}
