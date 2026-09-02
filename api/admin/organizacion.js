// GET /api/admin/organizacion — perfil de la organización del usuario
// autenticado. El formulario de eventos lo usa para mostrar la categoría y el
// lugar con los que se publicarán, que el gestor no elige.
import { obtenerSql } from '../_db.js'
import { requerirSesionEdge } from '../_auth.js'
import { organizacionDeSesion } from '../_organizacion.js'
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
    const organizacion = await organizacionDeSesion(sql, sesion.organizacionSlug)
    if (!organizacion) {
      return json({ error: 'La organización de tu cuenta ya no existe.' }, 404)
    }

    return json({
      organizacion: {
        nombre: organizacion.nombre,
        slug: organizacion.slug,
        categoriaDefecto: organizacion.categoria_defecto,
        lugarDefecto: organizacion.lugar_defecto,
        // ¿Elige el gestor el lugar evento a evento? (organización itinerante,
        // issue #33). Con false, el formulario muestra lugarDefecto como
        // solo lectura y el servidor lo impone, como siempre.
        lugarVariable: organizacion.lugar_variable === true,
        esOrganizacionCultural: organizacion.es_organizacion_cultural === true,
        // Decide si el panel enseña la pestaña "Mis eventos". NO basta con
        // `es_organizacion_cultural`: esa columna se añadió después y solo la
        // rellena el flujo de reclamación de comercios, así que las orgs de
        // siempre (TYL TYL, Teatro Municipal, La Nave, Ayuntamiento) la tienen
        // en false. Lo que de verdad habilita publicar es tener perfil de
        // eventos — `categoria_defecto` — porque es con lo que se publican.
        puedePublicarEventos:
          organizacion.es_organizacion_cultural === true || Boolean(organizacion.categoria_defecto),
      },
    })
  } catch (error) {
    console.error('Fallo en /api/admin/organizacion:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}
