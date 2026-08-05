// GET /api/comercios/:id — obtiene el perfil enriquecido de un comercio público
import { obtenerSql } from './_db.js'
import { json } from './_http.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Método no permitido' }, 405)
  }

  const url = new URL(req.url)
  const comercioId = url.pathname.split('/').pop()

  if (!comercioId) {
    return json({ error: 'ID de comercio requerido' }, 400)
  }

  try {
    const sql = obtenerSql()

    const [perfil] = await sql`
      SELECT comercio_id, descripcion, horarios, foto_principal, fotos,
             web, telefono, direccion, lat, lng
      FROM comercios_perfil
      WHERE comercio_id = ${comercioId}
    `

    return json({ perfil: perfil || null })
  } catch (error) {
    console.error('Error en /api/comercios:', error)
    return json({ error: 'Error en el servidor.' }, 500)
  }
}
