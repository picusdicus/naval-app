// GET /api/avisos — historial de avisos push (la "bandeja" de la app). Devuelve
// los avisos recientes en crudo; el filtrado por los temas del dispositivo se
// hace en el navegador (src/lib/useAvisos.js), igual que con los destacados: una
// sola respuesta cacheable sirve a todos, y el cliente ya sabe a qué está
// suscrito. Público y sin auth: un aviso es un evento ya publicado, no hay nada
// privado (el endpoint del dispositivo nunca sale de aquí).
export const config = { runtime: 'edge' }

import { obtenerSql } from './_db.js'
import { json } from './_http.js'

// Ventana del historial: más allá, un aviso ya no es "novedad".
const DIAS_HISTORIAL = 60
const LIMITE = 50

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Método no permitido' }, 405)
  }

  try {
    const sql = obtenerSql()
    const filas = await sql`
      SELECT referencia_id, titulo, cuerpo, url, temas,
             to_char(enviado_en, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS enviado_en
      FROM push_avisos
      WHERE enviado_en >= now() - (${DIAS_HISTORIAL} || ' days')::interval
      ORDER BY enviado_en DESC
      LIMIT ${LIMITE}
    `
    return json({ avisos: filas }, 200, {
      // Cache corta en CDN: la bandeja no necesita ser instantánea.
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    })
  } catch (error) {
    // La bandeja debe degradar a vacía sin romper la página.
    console.error('No se pudieron leer los avisos:', error)
    return json({ avisos: [], error: 'base-de-datos-no-disponible' })
  }
}
