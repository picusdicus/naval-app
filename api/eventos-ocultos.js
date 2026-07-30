// GET /api/eventos-ocultos — ids públicos de eventos ocultados por el superadmin.
//
// La agenda pública (src/lib/useEventosPublicos.js) filtra CLIENT-SIDE los
// eventos cuyo id (o alguno de sus idsSecundarios) esté en esta lista, tanto
// los estáticos como los de Neon. Devuelve {ocultos: []} con HTTP 200 si la
// base de datos no responde o la tabla aún no existe, para que la agenda nunca
// se rompa por esto.
//
// Edge Function con cache corta en el CDN (mismo patrón que /api/eventos y
// /api/destacados): ocultar un evento debe reflejarse en menos de un minuto.
export const config = { runtime: 'edge' }

import { obtenerSql } from './_db.js'

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const sql = obtenerSql()
    const filas = await sql`SELECT referencia_id FROM eventos_ocultos`
    return new Response(JSON.stringify({ ocultos: filas.map((f) => f.referencia_id) }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('No se pudieron leer los eventos ocultos:', error)
    return new Response(JSON.stringify({ ocultos: [], error: 'base-de-datos-no-disponible' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
