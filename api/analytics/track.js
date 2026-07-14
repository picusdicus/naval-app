// POST /api/analytics/track — registra un evento anónimo de análisis.
//
// Edge Function: el driver HTTP de Neon va sobre fetch (ver api/eventos.js).
export const config = { runtime: 'edge' }

import { obtenerSql } from '../_db.js'

const json = (datos, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  let cuerpo = {}
  try {
    cuerpo = await req.json()
  } catch {
    cuerpo = {}
  }

  const { tipoEvento, seccion, preguntaAsistente, comercioBuscado, organizacionId, eventoId } = cuerpo

  if (!tipoEvento) {
    return json({ error: 'tipoEvento es requerido.' }, 400)
  }

  // Un eventoId malformado haría fallar el INSERT entero (la columna es uuid);
  // mejor descartarlo y conservar el resto del registro.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const eventoIdValido = UUID.test(String(eventoId ?? '')) ? eventoId : null

  try {
    const sql = obtenerSql()
    await sql`
      INSERT INTO analytics (tipo_evento, seccion, pregunta_asistente, comercio_buscado, organizacion_id, evento_id)
      VALUES (${tipoEvento}, ${seccion || null}, ${preguntaAsistente || null}, ${comercioBuscado || null}, ${organizacionId || null}, ${eventoIdValido})
    `

    return json({ success: true }, 201)
  } catch (error) {
    console.error('Error en /api/analytics/track:', error)
    // No devolvemos error al frontend: el tracking no debe romper la experiencia.
    return json({ success: true })
  }
}
