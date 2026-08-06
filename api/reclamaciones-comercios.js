// GET /api/reclamaciones-comercios
// Retorna todas las reclamaciones (pendientes y aprobadas) con su estado
import { obtenerSql } from './_db.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 })
  }

  try {
    const sql = obtenerSql()

    // Obtener todas las reclamaciones pendientes y aprobadas
    const resultado = await sql`
      SELECT comercio_id, estado, id, creado_en
      FROM solicitudes_reclamacion
      WHERE estado IN ('pendiente', 'aprobada')
      ORDER BY creado_en DESC
    `

    // Agrupar por comercio_id y tomar el estado más reciente
    const reclamacionesPorComercio = {}
    for (const row of resultado) {
      if (!reclamacionesPorComercio[row.comercio_id]) {
        reclamacionesPorComercio[row.comercio_id] = {
          estado: row.estado,
          id: row.id,
          creado_en: row.creado_en,
        }
      }
    }

    return new Response(JSON.stringify(reclamacionesPorComercio), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[reclamaciones-comercios] Error:', error)
    // En caso de error, retorna un objeto vacío (falla abierto)
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
