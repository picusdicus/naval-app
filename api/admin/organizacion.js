// GET /api/admin/organizacion — perfil de la organización del usuario
// autenticado. El formulario de eventos lo usa para mostrar la categoría y el
// lugar con los que se publicarán, que el gestor no elige.
import { obtenerSql } from '../_db.js'
import { requerirSesion } from '../_auth.js'


export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  let sesion
  try {
    sesion = await requerirSesion(req, res)
  } catch (error) {
    // Falta ADMIN_JWT_SECRET: sin secreto no hay sesión que valga.
    console.error('Sesión mal configurada:', error.message)
    return res.status(401).json({ error: 'No autenticado' })
  }
  if (!sesion) return

  try {
    const sql = obtenerSql()
    const [organizacion] = await sql`
      SELECT nombre, slug, categoria_defecto, lugar_defecto
      FROM organizaciones
      WHERE slug = ${sesion.organizacionSlug}
    `
    if (!organizacion) {
      return res.status(404).json({ error: 'La organización de tu cuenta ya no existe.' })
    }

    return res.status(200).json({
      organizacion: {
        nombre: organizacion.nombre,
        slug: organizacion.slug,
        categoriaDefecto: organizacion.categoria_defecto,
        lugarDefecto: organizacion.lugar_defecto,
      },
    })
  } catch (error) {
    console.error('Fallo en /api/admin/organizacion:', error)
    return res.status(503).json({ error: 'No se pudo conectar con la base de datos.' })
  }
}
