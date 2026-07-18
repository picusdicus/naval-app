// POST /api/analytics/track — registra un evento anónimo de análisis.
//
// Edge Function: el driver HTTP de Neon va sobre fetch (ver api/eventos.js).
export const config = { runtime: 'edge' }

import { obtenerSql } from '../_db.js'
import { limitar, obtenerIp } from '../_ratelimit.js'
import { csrfInvalido, rechazoCsrf } from '../_http.js'

const json = (datos, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }
  if (csrfInvalido(req)) return rechazoCsrf()

  // Rate-limit por IP para que nadie inunde la tabla de analytics. Al exceder,
  // respondemos success sin insertar: `sendBeacon` no debe percibir el corte.
  const limite = await limitar({ clave: `track:ip:${obtenerIp(req)}`, limite: 60, ventanaS: 60 })
  if (!limite.ok) return json({ success: true })

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

  // Lista blanca cerrada: solo aceptamos los tipos que emite el frontend
  // (src/lib/useAnalytics.js). Impide que un cliente inyecte tipos arbitrarios
  // para envenenar las métricas.
  const TIPOS_PERMITIDOS = new Set([
    'visita',
    'pregunta_asistente',
    'busqueda_comercio',
    'visita_evento',
    'clic_destacado',
  ])
  if (!TIPOS_PERMITIDOS.has(tipoEvento)) {
    return json({ error: 'tipoEvento no válido.' }, 400)
  }

  // Un eventoId malformado haría fallar el INSERT entero (la columna es uuid);
  // mejor descartarlo y conservar el resto del registro.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const eventoIdValido = UUID.test(String(eventoId ?? '')) ? eventoId : null

  // Truncamos los campos de texto libre para acotar el tamaño de fila y evitar
  // que un cliente rellene la tabla con cadenas enormes.
  const recortar = (valor, max = 200) =>
    valor == null ? null : String(valor).slice(0, max)

  try {
    const sql = obtenerSql()
    await sql`
      INSERT INTO analytics (tipo_evento, seccion, pregunta_asistente, comercio_buscado, organizacion_id, evento_id)
      VALUES (${tipoEvento}, ${recortar(seccion)}, ${recortar(preguntaAsistente, 500)}, ${recortar(comercioBuscado)}, ${organizacionId || null}, ${eventoIdValido})
    `

    return json({ success: true }, 201)
  } catch (error) {
    console.error('Error en /api/analytics/track:', error)
    // No devolvemos error al frontend: el tracking no debe romper la experiencia.
    return json({ success: true })
  }
}
