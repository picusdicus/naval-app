// GET /api/organizadores — slug + nombre de las organizaciones activas, para
// el selector de organizadores del diálogo de avisos push.
//
// La lista de la UI es semi-fija: los fijos (Ayuntamiento, TYL TYL) viven en
// src/lib/temasPush.js y el cliente les suma esta respuesta. Se eligió el
// endpoint (y no derivar organizadores de los eventos ya cargados) porque una
// organización de Neon sin eventos publicados ese día debe seguir siendo
// suscribible — el mismo motivo por el que el TYL TYL no puede desaparecer
// del selector cuando para en verano.
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
      SELECT slug, nombre FROM organizaciones WHERE activa = true ORDER BY nombre
    `
    return json({ organizadores: filas }, 200, {
      // Cache en CDN: la lista de organizaciones cambia muy de tarde en tarde.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    })
  } catch (error) {
    // El selector debe funcionar con los organizadores fijos aunque Neon caiga.
    console.error('No se pudieron leer los organizadores:', error)
    return json({ organizadores: [], error: 'base-de-datos-no-disponible' })
  }
}
