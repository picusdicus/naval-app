// GET /api/fusiones-eventos — pares de fusión manual decididos por el
// superadmin (tabla fusiones_eventos, issue #27).
//
// La agenda pública (src/lib/useEventosPublicos.js) y la vista previa OG
// (api/og-evento.js) aplican estas fusiones CLIENT-SIDE como último paso del
// merge (aplicarFusionesManuales en src/lib/dedupEventos.js). Devuelve
// {fusiones: []} con HTTP 200 si la base de datos no responde o la tabla aún
// no existe: sin la lista simplemente no se aplica ninguna fusión y la agenda
// vuelve al comportamiento de siempre (dos tarjetas), nunca se rompe.
//
// Edge Function con cache corta en el CDN (mismo patrón que
// /api/eventos-ocultos): una fusión debe reflejarse en menos de un minuto.
// El panel superadmin NO usa este endpoint (usaría la respuesta cacheada):
// lee /api/super/fusiones, que va con auth y sin cache.
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
    const filas = await sql`SELECT referencia_principal, referencia_secundaria FROM fusiones_eventos`
    const fusiones = filas.map((f) => ({
      principal: f.referencia_principal,
      secundaria: f.referencia_secundaria,
    }))
    return new Response(JSON.stringify({ fusiones }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('No se pudieron leer las fusiones manuales:', error)
    return new Response(JSON.stringify({ fusiones: [], error: 'base-de-datos-no-disponible' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
