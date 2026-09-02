// Asignación manual de imagen ilustrativa a un evento concreto (superadmin).
//
//   PUT    /api/super/imagenes-asignaciones   {referenciaId, imagenId}
//   DELETE /api/super/imagenes-asignaciones?referenciaId=…   (vuelve a automática)
//
// La clave es el id PÚBLICO del evento, el mismo que usan eventos_ocultos,
// destacados y fusiones_eventos: estable entre regeneraciones del cron, así
// que la elección sobrevive a las sincronizaciones.

import { requerirSuperAdminEdge } from '../_auth.js'
import { csrfInvalido, json, queryDe, leerJson, rechazoCsrf } from '../_http.js'
import { obtenerSql } from '../_db.js'

export const config = { runtime: 'edge' }

// Mismo criterio que api/super/destacados.js para referencia_id: longitud y
// alfabeto acotados. Los ids reales son 'ev-…', 'fiestas-…', 'bd-<uuid>'.
const REFERENCIA_VALIDA = /^[A-Za-z0-9:_-]{1,200}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req) {
  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion
  if (csrfInvalido(req)) return rechazoCsrf()

  if (req.method === 'PUT') return asignar(req)
  if (req.method === 'DELETE') return quitar(req)
  return json({ error: 'Método no permitido' }, 405)
}

async function asignar(req) {
  const { referenciaId, imagenId } = await leerJson(req)

  if (!REFERENCIA_VALIDA.test(String(referenciaId ?? ''))) {
    return json({ error: 'Referencia de evento no válida.' }, 400)
  }
  if (!UUID.test(String(imagenId ?? ''))) {
    return json({ error: 'Imagen no válida.' }, 400)
  }

  try {
    const sql = obtenerSql()
    const filas = await sql`
      INSERT INTO imagenes_evento_asignaciones (referencia_id, imagen_id)
      VALUES (${referenciaId}, ${imagenId})
      ON CONFLICT (referencia_id) DO UPDATE SET imagen_id = EXCLUDED.imagen_id
      RETURNING referencia_id, imagen_id
    `
    return json({ asignacion: filas[0] })
  } catch (error) {
    // La FK falla si la imagen ya no existe: es un 400, no un fallo del server.
    console.error('Fallo al asignar imagen:', error)
    return json({ error: 'No se pudo asignar la imagen. ¿Sigue existiendo?' }, 400)
  }
}

async function quitar(req) {
  const { referenciaId } = queryDe(req)
  if (!REFERENCIA_VALIDA.test(String(referenciaId ?? ''))) {
    return json({ error: 'Referencia de evento no válida.' }, 400)
  }

  try {
    const sql = obtenerSql()
    await sql`DELETE FROM imagenes_evento_asignaciones WHERE referencia_id = ${referenciaId}`
    return json({ ok: true })
  } catch (error) {
    console.error('Fallo al quitar la asignación:', error)
    return json({ error: 'No se pudo quitar la asignación.' }, 502)
  }
}
