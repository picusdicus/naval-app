// GET /api/comercio-perfil?id=...
// Obtiene el perfil enriquecido de un comercio específico (público, sin auth)
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

    // Buscar el perfil del comercio
    const resultado = await sql`
      SELECT *
      FROM comercios_perfil
      WHERE comercio_id = ${comercioId}
      LIMIT 1
    `

    const perfil = resultado.length > 0 ? resultado[0] : null

    // Organización que gestiona el comercio, si reclamó su ficha. La ficha
    // pública la usa para listar "lo que organizan" (sus eventos publicados):
    // el vínculo bueno es `organizaciones.comercio_id`, no
    // `comercios_perfil.organizacion_id` (que quedó NULL en los perfiles
    // guardados antes de arreglar el upsert del panel).
    const [organizacion] = await sql`
      SELECT id, slug, nombre
      FROM organizaciones
      WHERE comercio_id = ${comercioId} AND activa = true
      LIMIT 1
    `

    return new Response(
      JSON.stringify({
        perfil,
        organizacion: organizacion || null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('[comercio-perfil] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Error en el servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
