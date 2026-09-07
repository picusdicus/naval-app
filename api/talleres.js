// GET /api/talleres — talleres publicados, para la página pública /talleres.
// Los borradores nunca salen del panel /admin.
//
// Edge Function (el driver HTTP de Neon va sobre fetch). Cache CDN de 60 s,
// misma ventana que /api/eventos.
//
// Fail-soft como el resto de endpoints públicos: si Neon no responde devuelve
// `{talleres: []}` con HTTP 200 — la página muestra su estado vacío en vez de
// romperse.
export const config = { runtime: 'edge' }

import { json } from './_http.js'
import { obtenerSql } from './_db.js'

const CACHE = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Método no permitido' }, 405)
  }

  try {
    const sql = obtenerSql()

    // Dos consultas y no un JOIN con agregación: el driver HTTP de Neon manda
    // una sentencia por petición, así que un JOIN tampoco ahorraría viajes, y
    // dos listas planas se agrupan en JS sin duplicar las columnas del taller
    // por cada turno.
    const filas = await sql`
      SELECT id, nombre, categoria, descripcion, lugar, precio, edades,
             imagen_url, curso
      FROM talleres
      WHERE estado = 'publicado'
      ORDER BY nombre ASC
    `
    const horarios = await sql`
      SELECT h.id, h.taller_id, h.etiqueta, h.dias, h.hora_inicio, h.hora_fin,
             h.lugar, h.orden
      FROM talleres_horarios h
      JOIN talleres t ON t.id = h.taller_id
      WHERE t.estado = 'publicado'
      ORDER BY h.orden ASC
    `

    const porTaller = new Map()
    for (const h of horarios) {
      if (!porTaller.has(h.taller_id)) porTaller.set(h.taller_id, [])
      porTaller.get(h.taller_id).push({
        id: h.id,
        etiqueta: h.etiqueta || '',
        dias: h.dias || [],
        horaInicio: h.hora_inicio || '',
        horaFin: h.hora_fin || '',
        lugar: h.lugar || '',
      })
    }

    const talleres = filas.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      categoria: t.categoria,
      descripcion: t.descripcion || '',
      lugar: t.lugar || '',
      precio: t.precio || '',
      edades: t.edades || '',
      imagen: t.imagen_url || '',
      curso: t.curso || '',
      turnos: porTaller.get(t.id) || [],
    }))

    return json({ talleres }, 200, CACHE)
  } catch (error) {
    console.error('No se pudieron leer los talleres publicados:', error)
    return json({ talleres: [], error: 'base-de-datos-no-disponible' }, 200)
  }
}
