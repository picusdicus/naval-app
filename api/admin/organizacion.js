// GET /api/admin/organizacion — perfil de la organización del usuario
// autenticado. El formulario de eventos lo usa para mostrar la categoría y el
// lugar con los que se publicarán, que el gestor no elige.
import { obtenerSql } from '../_db.js'
import { requerirSesionEdge } from '../_auth.js'
import { json } from '../_http.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Método no permitido' }, 405)
  }

  const sesion = await requerirSesionEdge(req)
  if (sesion instanceof Response) return sesion

  try {
    const sql = obtenerSql()
    const [organizacion] = await sql`
      SELECT nombre, slug, categoria_defecto, lugar_defecto
      FROM organizaciones
      WHERE slug = ${sesion.organizacionSlug}
    `
    if (!organizacion) {
      return json({ error: 'La organización de tu cuenta ya no existe.' }, 404)
    }

    return json({
      organizacion: {
        nombre: organizacion.nombre,
        slug: organizacion.slug,
        categoriaDefecto: organizacion.categoria_defecto,
        lugarDefecto: organizacion.lugar_defecto,
      },
    })
  } catch (error) {
    console.error('Fallo en /api/admin/organizacion:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}
