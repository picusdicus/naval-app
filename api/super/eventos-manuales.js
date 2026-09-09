// /api/super/eventos-manuales — el superadmin crea eventos a mano desde el tab
// Eventos de /admin, en nombre de cualquier organizador (existente o nuevo).
//
//   GET  — { organizaciones: [{id, nombre, slug}], lugares: [...] } para rellenar
//          los desplegables del formulario: todas las organizaciones activas y
//          los lugares ya usados en eventos_usuario (+ lugar_defecto de las orgs).
//   GET  ?id= — un evento suelto (crudo, tal cual está en la base) para
//          prerrellenar el formulario en modo edición. Se lee de la base y no
//          del listado ya fusionado del tab: la agenda aplica fusiones y
//          propagación de carteles entre hermanos, y guardar eso volvería a
//          escribir en la fila datos que no son suyos.
//   POST — crea una fila en eventos_usuario. El organizador llega como
//          `organizacionId` (una existente) o como `organizacionNombre` (se crea
//          una organización nueva con slug derivado del nombre; si ese slug ya
//          existe se reutiliza esa organización en vez de duplicarla).
//   PUT  ?id= — edita un evento ya creado a mano. Sin filtro por
//          `organizacion_id` (esa es la diferencia con /api/admin/eventos: el
//          superadmin edita eventos de cualquier organización), pero solo de
//          filas con `origen_externo_id IS NULL` — ver `editar`.
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

const aFormulario = (f) => ({
  id: f.id,
  titulo: f.titulo,
  descripcion: f.descripcion ?? '',
  categoria: f.categoria ?? '',
  lugar: f.lugar ?? '',
  fecha: f.fecha,
  hora: f.hora ?? '',
  horaFin: f.hora_fin ?? '',
  imagen: f.imagen_url ?? '',
  estado: f.estado,
  organizacionId: f.organizacion_id,
  organizacionNombre: f.organizacion,
})

// La fila cruda que el formulario de edición necesita. `fecha_inicio` se
// formatea en SQL: el driver devuelve las columnas `date` como Date y
// convertirlas en JS arrastra la zona horaria.
const leerFila = (sql, id) => sql`
  SELECT e.id, e.titulo, e.descripcion, e.categoria, e.lugar,
         to_char(e.fecha_inicio, 'YYYY-MM-DD') AS fecha,
         e.hora, e.hora_fin, e.imagen_url, e.estado,
         e.origen_externo_id, e.organizacion_id, o.nombre AS organizacion
  FROM eventos_usuario e
  JOIN organizaciones o ON o.id = e.organizacion_id
  WHERE e.id = ${id}
`

/**
 * Un evento sincronizado (`origen_externo_id` no nulo: ig-…, deportes-…) no se
 * edita por aquí aunque viva en la misma tabla: el upsert del webhook o del
 * cron reescribe título, descripción e imagen en la siguiente pasada y el
 * cambio se perdería en silencio. Editarlos es otra tarea (habría que decidir
 * qué campos quedan fijados frente a la ingesta), no un UPDATE más.
 */
function rechazoSincronizado() {
  return json(
    {
      error:
        'Este evento viene de una sincronización automática y no se edita aquí: la próxima pasada del cron sobrescribiría los cambios.',
    },
    400,
  )
}

async function obtenerUno(sql, id) {
  const [fila] = await leerFila(sql, id)
  if (!fila) return json({ error: 'Ese evento no existe.' }, 404)
  if (fila.origen_externo_id) return rechazoSincronizado()
  return json({ evento: aFormulario(fila) })
}

async function editar(sql, id, cuerpo) {
  const [fila] = await leerFila(sql, id)
  if (!fila) return json({ error: 'Ese evento no existe.' }, 404)
  if (fila.origen_externo_id) return rechazoSincronizado()

  // Editar toca UNA fila y solo esa. A diferencia de /api/admin/eventos, aquí
  // una fecha de fin no convierte el evento en ciclo ni crea copias: esta vía
  // no sabe crear series (el POST tampoco acepta `fechaFin`), así que hacerlo
  // solo al editar dejaría la única forma de generar copias escondida detrás
  // de una edición, y repetirla las multiplicaría sin deduplicar. El estado y
  // el organizador tampoco se tocan: se conservan los de la fila.
  const evento = {
    ...cuerpo,
    ambito: 'navalcarnero',
    provincia: '',
    poblacion: '',
    fechaFin: '',
    estado: fila.estado,
  }
  const errores = validarEvento(evento)
  if (Object.keys(errores).length > 0) {
    return json({ error: 'Revisa los campos del formulario.', errores }, 422)
  }

  const e = normalizarEvento(evento)
  const [actualizado] = await sql`
    UPDATE eventos_usuario SET
      titulo = ${e.titulo}, descripcion = ${e.descripcion}, categoria = ${e.categoria},
      lugar = ${e.lugar}, fecha_inicio = ${e.fecha}, hora = ${e.hora},
      hora_fin = ${e.horaFin}, imagen_url = ${e.imagen}, actualizado_en = now()
    WHERE id = ${id}
    RETURNING id, titulo, estado
  `

  return json({
    evento: {
      id: actualizado.id,
      referenciaId: `bd-${actualizado.id}`,
      titulo: actualizado.titulo,
      estado: actualizado.estado,
      fecha: e.fecha,
    },
  })
}

export default async function handler(req) {
  if (csrfInvalido(req)) return rechazoCsrf()

  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  const id = new URL(req.url).searchParams.get('id')
  // Un id con otra forma nunca existirá: cortamos antes de tocar la base, que
  // rechazaría el uuid inválido con un error de tipo. El cliente manda el uuid
  // pelado (sin el prefijo `bd-` de la agenda), pero no nos fiamos de eso.
  if (id != null && !UUID.test(id)) {
    return json({ error: 'Ese evento no existe.' }, req.method === 'PUT' ? 400 : 404)
  }

  try {
    const sql = obtenerSql()
    if (req.method === 'GET') return id ? await obtenerUno(sql, id) : await listarOpciones(sql)
    if (req.method === 'POST') return await crear(sql, await leerJson(req))
    if (req.method === 'PUT') {
      if (!id) return json({ error: 'Falta el id del evento a editar.' }, 400)
      return await editar(sql, id, await leerJson(req))
    }
    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/super/eventos-manuales:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}
