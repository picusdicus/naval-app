// GET    /api/super/eventos          — ids de eventos ocultados (para el panel)
// POST   /api/super/eventos           — oculta un evento { referenciaId }
// DELETE /api/super/eventos?ref=…      — vuelve a mostrar un evento
//
// Ocultar/mostrar es global y reversible: se guarda solo el id público del
// evento en la tabla eventos_ocultos (misma idea que destacados). No toca el
// estado del evento de la organización; la agenda pública filtra CLIENT-SIDE
// (src/lib/useEventosPublicos.js + GET /api/eventos-ocultos). La lista completa
// de eventos publicados la arma el propio panel a partir de los JSON estáticos
// y /api/eventos, así que aquí no hace falta devolverla.
import { requerirSuperAdminEdge } from '../_auth.js'
import { obtenerSql } from '../_db.js'
import { json, leerJson, queryDe, csrfInvalido, rechazoCsrf } from '../_http.js'

export const config = { runtime: 'edge' }

// Mismo alfabeto y longitud que la referencia de destacados: ids opacos de
// eventos (ev-…, aytocult-…, bd-<uuid>, ig-…), nunca espacios ni control.
const REFERENCIA_REGEX = /^[A-Za-z0-9._/-]+$/

function referenciaValida(ref) {
  return typeof ref === 'string' && ref.length > 0 && ref.length <= 200 && REFERENCIA_REGEX.test(ref)
}

async function asegurarTabla(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS eventos_ocultos (
      referencia_id text PRIMARY KEY,
      oculto_en timestamptz NOT NULL DEFAULT now()
    )
  `
}

export default async function handler(req) {
  if (csrfInvalido(req)) return rechazoCsrf()

  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  try {
    const sql = obtenerSql()

    if (req.method === 'GET') {
      let filas
      try {
        filas = await sql`SELECT referencia_id FROM eventos_ocultos ORDER BY oculto_en DESC`
      } catch {
        // La tabla puede no existir aún si nunca se ocultó nada.
        filas = []
      }
      return json({ ocultos: filas.map((f) => f.referencia_id) })
    }

    if (req.method === 'POST') {
      const { referenciaId } = await leerJson(req)
      if (!referenciaValida(referenciaId)) return json({ error: 'Referencia de evento no válida.' }, 400)
      await asegurarTabla(sql)
      await sql`
        INSERT INTO eventos_ocultos (referencia_id)
        VALUES (${referenciaId})
        ON CONFLICT (referencia_id) DO NOTHING
      `
      return json({ oculto: true, referenciaId })
    }

    if (req.method === 'DELETE') {
      const { ref } = queryDe(req)
      if (!referenciaValida(ref)) return json({ error: 'Referencia de evento no válida.' }, 400)
      await asegurarTabla(sql)
      await sql`DELETE FROM eventos_ocultos WHERE referencia_id = ${ref}`
      return json({ mostrado: true, referenciaId: ref })
    }

    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/super/eventos:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}
