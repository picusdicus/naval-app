// GET /api/imagenes-evento-genericas — lista las imágenes genéricas activas.
// Edge, cacheable (~60s). Fail-soft: devuelve {imagenes: []} con 200 si Neon cae.

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
    const imagenes = await sql`
      SELECT id, categoria, disciplina, url, autor, fuente, licencia, descripcion
      FROM imagenes_evento_genericas
      WHERE activo = true
      ORDER BY categoria, disciplina, creado_en
    `
    return json({ imagenes }, 200, CACHE)
  } catch (error) {
    console.error('Error al leer imágenes genéricas:', error)
    return json({ imagenes: [] }, 200, CACHE)
  }
}
