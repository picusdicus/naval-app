// GET /api/comercios/reclamacion-pendiente?id=...
// Verifica si existe una reclamación pendiente para un comercio específico
import { obtenerSql } from '../_db.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 })
  }

  const url = new URL(req.url)
  const comercioId = url.searchParams.get('id')

  if (!comercioId) {
    return new Response(JSON.stringify({ error: 'ID de comercio requerido' }), { status: 400 })
  }

  try {
    const sql = obtenerSql()

    // Buscar si hay una reclamación pendiente para este comercio
    const resultado = await sql`
      SELECT id, nombre, email, creado_en, estado
      FROM solicitudes_reclamacion
      WHERE comercio_id = ${comercioId}
      AND estado = 'pendiente'
      LIMIT 1
    `

    const tienePendiente = resultado.length > 0

    return new Response(
      JSON.stringify({
        tienePendiente,
        solicitud: tienePendiente ? resultado[0] : null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('[reclamacion-pendiente] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Error en el servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
