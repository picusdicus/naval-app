// GET /api/super/analytics — obtiene métricas globales anónimas de la app
import { requerirSuperAdmin } from '../_auth.js'
import { obtenerSql } from '../_db.js'

export default async function handler(req, res) {
  const sesion = requerirSuperAdmin(req, res)
  if (!sesion) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const sql = obtenerSql()

    // Visitas por sección (últimos 30 días)
    const visitasPorSeccion = await sql`
      SELECT
        seccion,
        COUNT(*) as total
      FROM analytics
      WHERE tipo_evento = 'visita' AND creado_en > NOW() - INTERVAL '30 days'
      GROUP BY seccion
      ORDER BY total DESC
    `

    // Eventos publicados por organización
    const eventosPorOrg = await sql`
      SELECT
        o.nombre,
        o.id,
        COUNT(e.id) as total
      FROM organizaciones o
      LEFT JOIN eventos_usuario e ON o.id = e.organizacion_id AND e.estado = 'publicado'
      GROUP BY o.id, o.nombre
      ORDER BY total DESC
    `

    // Preguntas más frecuentes al asistente
    const preguntasFrequentes = await sql`
      SELECT
        pregunta_asistente,
        COUNT(*) as total
      FROM analytics
      WHERE tipo_evento = 'pregunta_asistente' AND pregunta_asistente IS NOT NULL
      GROUP BY pregunta_asistente
      ORDER BY total DESC
      LIMIT 10
    `

    // Comercios más buscados
    const comerciosBuscados = await sql`
      SELECT
        comercio_buscado,
        COUNT(*) as total
      FROM analytics
      WHERE tipo_evento = 'busqueda_comercio' AND comercio_buscado IS NOT NULL
      GROUP BY comercio_buscado
      ORDER BY total DESC
      LIMIT 10
    `

    // Estadísticas generales
    const [resumenEventos] = await sql`
      SELECT
        COUNT(*) as total_eventos,
        SUM(CASE WHEN estado = 'publicado' THEN 1 ELSE 0 END) as eventos_publicados,
        SUM(CASE WHEN estado = 'borrador' THEN 1 ELSE 0 END) as eventos_borradores
      FROM eventos_usuario
    `

    const [resumenOrgs] = await sql`
      SELECT
        COUNT(*) as total_orgs,
        SUM(CASE WHEN activa = true THEN 1 ELSE 0 END) as orgs_activas
      FROM organizaciones
    `

    const [resumenUsuarios] = await sql`
      SELECT
        COUNT(*) as total_usuarios,
        SUM(CASE WHEN rol = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN rol = 'editor' THEN 1 ELSE 0 END) as editores,
        SUM(CASE WHEN rol = 'vecino' THEN 1 ELSE 0 END) as vecinos
      FROM usuarios
    `

    const [resumenVisitas] = await sql`
      SELECT
        COUNT(*) as total_visitas_30d
      FROM analytics
      WHERE tipo_evento = 'visita' AND creado_en > NOW() - INTERVAL '30 days'
    `

    return res.status(200).json({
      analytics: {
        visitasPorSeccion: visitasPorSeccion.map((v) => ({
          seccion: v.seccion,
          total: v.total,
        })),
        eventosPorOrganizacion: eventosPorOrg.map((e) => ({
          organizacionId: e.id,
          organizacionNombre: e.nombre,
          total: e.total,
        })),
        preguntasFrequentes: preguntasFrequentes.map((p) => ({
          pregunta: p.pregunta_asistente,
          total: p.total,
        })),
        comerciosBuscados: comerciosBuscados.map((c) => ({
          comercio: c.comercio_buscado,
          total: c.total,
        })),
        resumen: {
          totalEventos: resumenEventos.total_eventos,
          eventosPublicados: resumenEventos.eventos_publicados,
          eventosBorradores: resumenEventos.eventos_borradores,
          totalOrganizaciones: resumenOrgs.total_orgs,
          organizacionesActivas: resumenOrgs.orgs_activas,
          totalUsuarios: resumenUsuarios.total_usuarios,
          admins: resumenUsuarios.admins,
          editores: resumenUsuarios.editores,
          vecinos: resumenUsuarios.vecinos,
          visitasUltimos30Dias: resumenVisitas.total_visitas_30d,
        },
      },
    })
  } catch (error) {
    console.error('Error en /api/super/analytics:', error)
    return res.status(503).json({ error: 'No se pudo conectar con la base de datos.' })
  }
}
