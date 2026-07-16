// GET /api/destacados — lista cruda de destacados vigentes, para que el
// cliente la resuelva contra los datos que ya tiene (eventos estáticos y de
// Neon, comercios del directorio). Solo salen los 'activo' dentro de su
// periodo de vigencia: un destacado caducado desaparece solo, sin cron.
//
// Edge Function: el driver HTTP de Neon (`neon()`) va sobre fetch, así que no
// hace falta el runtime de Node y no consume una de las 12 Serverless Functions.
export const config = { runtime: 'edge' }

import { obtenerSql } from './_db.js'
import { json } from './_http.js'

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Método no permitido' }, 405)
  }

  try {
    const sql = obtenerSql()

    const filas = await sql`
      SELECT tipo, referencia_id, orden, imagen_url
      FROM destacados
      WHERE estado = 'activo'
        AND fecha_inicio <= CURRENT_DATE
        AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
      ORDER BY orden ASC, creado_en ASC
    `

    const destacados = filas.map((d) => ({
      tipo: d.tipo,
      referenciaId: d.referencia_id,
      orden: d.orden,
      imagen: d.imagen_url || '',
    }))

    return json({ destacados }, 200, {
      // Cache corta en el CDN: un destacado recién contratado debe aparecer
      // en menos de un minuto, pero no hace falta consultar Neon por visita.
      // max-age=0 evita que además el navegador reutilice la respuesta por
      // heurística (sin él, cuánto dura es decisión de cada navegador).
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    })
  } catch (error) {
    // Las secciones de destacados se ocultan si la base no responde; el resto
    // de la app (agenda estática, directorio) sigue funcionando.
    console.error('No se pudieron leer los destacados:', error)
    return json({ destacados: [], error: 'base-de-datos-no-disponible' }, 200)
  }
}
