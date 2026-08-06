// GET /api/comercio-reclamacion?id=...
// Verifica si existe una reclamación (pendiente o aprobada) para un comercio específico
import { obtenerSql } from './_db.js'

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

    // Buscar si hay una reclamación (pendiente o aprobada) para este comercio
    const resultado = await sql`
      SELECT id, nombre, email, creado_en, estado
      FROM solicitudes_reclamacion
      WHERE comercio_id = ${comercioId}
      AND estado IN ('pendiente', 'aprobada')
      ORDER BY creado_en DESC
      LIMIT 1
    `

    const tieneReclamacion = resultado.length > 0
    const reclamacion = tieneReclamacion ? resultado[0] : null
    const tienePendiente = reclamacion?.estado === 'pendiente'
    const tieneAprobada = reclamacion?.estado === 'aprobada'

    return new Response(
      JSON.stringify({
        tieneReclamacion,
        tienePendiente,
        tieneAprobada,
        solicitud: reclamacion,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('[comercio-reclamacion] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Error en el servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
