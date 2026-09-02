// GET /api/imagenes-evento-genericas — lista las imágenes genéricas activas.
// Edge, cacheable (~60s). Fail-soft: devuelve {imagenes: []} con 200 si Neon cae.

import { json } from './_http.js'
import { obtenerSql } from './_db.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(json({ error: 'Método no permitido' }), { status: 405 })
  }

  try {
    const sql = obtenerSql()
    const imagenes = await sql`
      SELECT id, categoria, disciplina, url, autor, fuente, licencia, descripcion
      FROM imagenes_evento_genericas
      WHERE activo = true
      ORDER BY categoria, disciplina, creado_en
    `

    return new Response(json({ imagenes }), {
      status: 200,
      headers: {
        'cache-control': 's-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Error al leer imágenes genéricas:', error)
    return new Response(json({ imagenes: [] }), {
      status: 200,
      headers: {
        'cache-control': 's-maxage=60, stale-while-revalidate=300',
      },
    })
  }
}
