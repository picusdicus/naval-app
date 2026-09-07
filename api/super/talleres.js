// /api/super/talleres — CRUD de los talleres municipales desde el tab Talleres
// de /admin. Un solo fichero por método con el id en `?id=` (no en un segmento
// dinámico), igual que api/admin/eventos.js: así el middleware de desarrollo de
// vite.config.js no necesita ningún caso especial.
//
//   GET            — todos los talleres (incluidos borradores) con sus turnos
//   GET    ?id=    — uno solo, para prerrellenar el formulario de edición
//   POST           — crear
//   PUT    ?id=    — reemplazar todos los campos (y todos los turnos)
//   PATCH  ?id=    — cambiar solo el estado
//   DELETE ?id=    — borrar (los turnos caen por ON DELETE CASCADE)
//
// La validación es la misma que ejecuta el formulario en el navegador
// (validarTaller en src/lib/tallerForm.js): el cliente nunca se cree.
import { requerirSuperAdminEdge } from '../_auth.js'
import { obtenerSql } from '../_db.js'
import { json, leerJson, queryDe, csrfInvalido, rechazoCsrf } from '../_http.js'
import { validarTaller, normalizarTaller, ESTADOS_TALLER } from '../../src/lib/tallerForm.js'

export const config = { runtime: 'edge' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Turnos de varios talleres a la vez, agrupados por taller_id. */
async function turnosDe(sql, ids) {
  if (ids.length === 0) return new Map()
  const filas = await sql`
    SELECT id, taller_id, etiqueta, dias, hora_inicio, hora_fin, lugar, orden
    FROM talleres_horarios
    WHERE taller_id = ANY(${ids})
    ORDER BY orden ASC
  `
  const mapa = new Map()
  for (const h of filas) {
    if (!mapa.has(h.taller_id)) mapa.set(h.taller_id, [])
    mapa.get(h.taller_id).push({
      id: h.id,
      etiqueta: h.etiqueta || '',
      dias: h.dias || [],
      horaInicio: h.hora_inicio || '',
      horaFin: h.hora_fin || '',
      lugar: h.lugar || '',
    })
  }
  return mapa
}

const aSalida = (t, turnos) => ({
  id: t.id,
  nombre: t.nombre,
  categoria: t.categoria,
  descripcion: t.descripcion || '',
  lugar: t.lugar || '',
  precio: t.precio || '',
  edades: t.edades || '',
  imagen: t.imagen_url || '',
  curso: t.curso || '',
  estado: t.estado,
  turnos: turnos || [],
})

const COLUMNAS = `id, nombre, categoria, descripcion, lugar, precio, edades,
                  imagen_url, curso, estado`

async function listar(sql) {
  const filas = await sql`
    SELECT id, nombre, categoria, descripcion, lugar, precio, edades,
           imagen_url, curso, estado
    FROM talleres
    ORDER BY nombre ASC
  `
  const turnos = await turnosDe(sql, filas.map((t) => t.id))
  const talleres = filas.map((t) => aSalida(t, turnos.get(t.id)))

  return json({
    talleres,
    resumen: {
      total: talleres.length,
      publicados: talleres.filter((t) => t.estado === 'publicado').length,
      borradores: talleres.filter((t) => t.estado === 'borrador').length,
    },
  })
}

async function uno(sql, id) {
  const [fila] = await sql`
    SELECT id, nombre, categoria, descripcion, lugar, precio, edades,
           imagen_url, curso, estado
    FROM talleres WHERE id = ${id}
  `
  if (!fila) return json({ error: 'Ese taller no existe.' }, 404)
  const turnos = await turnosDe(sql, [id])
  return json({ taller: aSalida(fila, turnos.get(id)) })
}

/**
 * Reescribe los turnos de un taller: se borran los que tenía y se insertan los
 * nuevos. El driver HTTP de Neon manda una sentencia por petición, así que van
 * secuenciales (mismo patrón que los ciclos de eventos).
 *
 * Reemplazo completo y no diff campo a campo porque el formulario envía
 * siempre la lista entera: un turno eliminado en el navegador tiene que
 * desaparecer, y casarlo por id complicaría el cliente sin ganar nada (los
 * turnos no se referencian desde ninguna otra tabla).
 */
async function guardarTurnos(sql, tallerId, turnos) {
  await sql`DELETE FROM talleres_horarios WHERE taller_id = ${tallerId}`
  for (const t of turnos) {
    await sql`
      INSERT INTO talleres_horarios (taller_id, etiqueta, dias, hora_inicio, hora_fin, lugar, orden)
      VALUES (${tallerId}, ${t.etiqueta || null}, ${t.dias}, ${t.horaInicio || null},
              ${t.horaFin || null}, ${t.lugar || null}, ${t.orden})
    `
  }
}

async function crear(sql, cuerpo) {
  const errores = validarTaller(cuerpo)
  if (Object.keys(errores).length > 0) {
    return json({ error: 'Revisa los campos del formulario.', errores }, 422)
  }

  const t = normalizarTaller(cuerpo)
  const [fila] = await sql`
    INSERT INTO talleres (nombre, categoria, descripcion, lugar, precio, edades,
                          imagen_url, curso, estado)
    VALUES (${t.nombre}, ${t.categoria}, ${t.descripcion}, ${t.lugar}, ${t.precio},
            ${t.edades}, ${t.imagen}, ${t.curso}, ${t.estado})
    RETURNING id, nombre, categoria, descripcion, lugar, precio, edades,
              imagen_url, curso, estado
  `
  await guardarTurnos(sql, fila.id, t.turnos)
  return json({ taller: aSalida(fila, t.turnos) }, 201)
}

async function reemplazar(sql, id, cuerpo) {
  const errores = validarTaller(cuerpo)
  if (Object.keys(errores).length > 0) {
    return json({ error: 'Revisa los campos del formulario.', errores }, 422)
  }

  const t = normalizarTaller(cuerpo)
  const [fila] = await sql`
    UPDATE talleres SET
      nombre = ${t.nombre}, categoria = ${t.categoria}, descripcion = ${t.descripcion},
      lugar = ${t.lugar}, precio = ${t.precio}, edades = ${t.edades},
      imagen_url = ${t.imagen}, curso = ${t.curso}, estado = ${t.estado},
      actualizado_en = now()
    WHERE id = ${id}
    RETURNING id, nombre, categoria, descripcion, lugar, precio, edades,
              imagen_url, curso, estado
  `
  if (!fila) return json({ error: 'Ese taller no existe.' }, 404)
  await guardarTurnos(sql, id, t.turnos)
  return json({ taller: aSalida(fila, t.turnos) })
}

async function cambiarEstado(sql, id, cuerpo) {
  const estado = String(cuerpo.estado ?? '').trim()
  if (!ESTADOS_TALLER.includes(estado)) return json({ error: 'Estado no válido.' }, 400)

  const [fila] = await sql`
    UPDATE talleres SET estado = ${estado}, actualizado_en = now()
    WHERE id = ${id}
    RETURNING id, nombre, categoria, descripcion, lugar, precio, edades,
              imagen_url, curso, estado
  `
  if (!fila) return json({ error: 'Ese taller no existe.' }, 404)
  const turnos = await turnosDe(sql, [id])
  return json({ taller: aSalida(fila, turnos.get(id)) })
}

async function borrar(sql, id) {
  const [fila] = await sql`DELETE FROM talleres WHERE id = ${id} RETURNING id`
  if (!fila) return json({ error: 'Ese taller no existe.' }, 404)
  // La fila de `destacados` que lo apuntara queda huérfana igual que con un
  // evento borrado: useDestacados filtra en silencio las referencias muertas.
  return json({ ok: true })
}

export default async function handler(req) {
  if (csrfInvalido(req)) return rechazoCsrf()

  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  const { id } = queryDe(req)
  // Un id malformado se rechaza antes de tocar la base de datos.
  if (id !== undefined && !UUID.test(id)) {
    return json({ error: 'Identificador de taller no válido.' }, 400)
  }

  try {
    const sql = obtenerSql()

    if (req.method === 'GET') return id ? await uno(sql, id) : await listar(sql)
    if (req.method === 'POST') return await crear(sql, await leerJson(req))

    if (!id) return json({ error: 'Falta el identificador del taller.' }, 400)
    if (req.method === 'PUT') return await reemplazar(sql, id, await leerJson(req))
    if (req.method === 'PATCH') return await cambiarEstado(sql, id, await leerJson(req))
    if (req.method === 'DELETE') return await borrar(sql, id)

    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/super/talleres:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}
