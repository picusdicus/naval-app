// POST /api/analytics/track — registra un evento anónimo de análisis
import { obtenerSql } from '../_db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { tipoEvento, seccion, preguntaAsistente, comercioBuscado, organizacionId } = req.body || {}

  if (!tipoEvento) {
    return res.status(400).json({ error: 'tipoEvento es requerido.' })
  }

  try {
    const sql = obtenerSql()
    await sql`
      INSERT INTO analytics (tipo_evento, seccion, pregunta_asistente, comercio_buscado, organizacion_id)
      VALUES (${tipoEvento}, ${seccion || null}, ${preguntaAsistente || null}, ${comercioBuscado || null}, ${organizacionId || null})
    `

    return res.status(201).json({ success: true })
  } catch (error) {
    console.error('Error en /api/analytics/track:', error)
    // No devolvemos error al frontend: el tracking no debe romper la experiencia
    return res.status(200).json({ success: true })
  }
}
