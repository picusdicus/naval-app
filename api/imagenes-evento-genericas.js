// GET /api/imagenes-evento-genericas — imágenes ilustrativas de eventos.
// Cacheable (~60s). Fail-soft: devuelve listas vacías con 200 si Neon cae.
//
// Devuelve DOS cosas en la misma respuesta, a propósito: las imágenes activas
// y el mapa de asignaciones manuales (id público de evento → id de imagen).
// Van juntas porque la app las necesita siempre a la vez y así el navegador
// —y api/og-evento.js— hacen una sola petición en lugar de dos.

import { json } from './_http.js'
import { obtenerSql } from './_db.js'

export const config = { runtime: 'edge' }

const CACHE = { 'cache-control': 's-maxage=60, stale-while-revalidate=300' }

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Método no permitido' }, 405)
  }

  try {
    const sql = obtenerSql()
    // El driver HTTP de Neon manda una sentencia por petición: dos consultas
    // son dos viajes, pero siguen siendo un solo fetch desde el cliente.
    const imagenes = await sql`
      SELECT id, categoria, disciplina, url, autor, fuente, licencia, descripcion,
             solo_asignacion AS "soloAsignacion"
      FROM imagenes_evento_genericas
      WHERE activo = true
      ORDER BY categoria, disciplina, creado_en
    `
    // Solo las que apuntan a una imagen ACTIVA: una asignación a una imagen
    // desactivada no debe resucitarla, el evento vuelve a la automática.
    const filas = await sql`
      SELECT a.referencia_id, a.imagen_id
      FROM imagenes_evento_asignaciones a
      JOIN imagenes_evento_genericas g ON g.id = a.imagen_id
      WHERE g.activo = true
    `
    const asignaciones = Object.fromEntries(
      filas.map((f) => [f.referencia_id, f.imagen_id])
    )
    return json({ imagenes, asignaciones }, 200, CACHE)
  } catch (error) {
    console.error('Error al leer imágenes genéricas:', error)
    return json({ imagenes: [], asignaciones: {} }, 200, CACHE)
  }
}
