// Alta y baja de suscripciones push anónimas (fase 1 de NOTIFICACIONES_PUSH.md).
//
//   POST   /api/push  { suscripcion: {endpoint, keys:{p256dh, auth}}, temas }
//                      → alta o actualización (upsert por endpoint)
//   DELETE /api/push  { endpoint }
//                      → baja del dispositivo
//
// Sin autenticación: la suscripción es anónima por diseño. La defensa es la
// misma que en el resto de mutadores públicos (track, acceso): CSRF por
// Origin + rate-limit por IP. Los temas se validan contra la lista blanca
// ('todos' | 'cat:<categoria>' | 'org:<slug>') en src/lib/temasPush.js.
export const config = { runtime: 'edge' }

import { obtenerSql } from './_db.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from './_http.js'
import { limitar, obtenerIp, respuesta429 } from './_ratelimit.js'
import { validarTemas } from '../src/lib/temasPush.js'

// Un endpoint de push es una URL https del push service del navegador.
function endpointValido(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false
  try {
    return new URL(endpoint).protocol === 'https:'
  } catch {
    return false
  }
}

// Claves de la suscripción: base64url razonablemente corto, nunca contenido libre.
const RE_CLAVE = /^[A-Za-z0-9_=-]{10,256}$/

export default async function handler(req) {
  if (csrfInvalido(req)) return rechazoCsrf()

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return json({ error: 'Método no permitido' }, 405)
  }

  const limite = await limitar({
    clave: `push:ip:${obtenerIp(req)}`,
    limite: 20,
    ventanaS: 10 * 60,
  })
  if (!limite.ok) return respuesta429(limite.resetEnS)

  const cuerpo = await leerJson(req)
  const sql = obtenerSql()

  if (req.method === 'DELETE') {
    const { endpoint } = cuerpo
    if (!endpointValido(endpoint)) {
      return json({ error: 'Falta el endpoint de la suscripción.' }, 400)
    }
    await sql`DELETE FROM push_suscripciones WHERE endpoint = ${endpoint}`
    return json({ ok: true })
  }

  const { suscripcion, temas } = cuerpo
  const endpoint = suscripcion?.endpoint
  const p256dh = suscripcion?.keys?.p256dh
  const auth = suscripcion?.keys?.auth

  if (!endpointValido(endpoint) || !RE_CLAVE.test(String(p256dh)) || !RE_CLAVE.test(String(auth))) {
    return json({ error: 'Suscripción no válida.' }, 400)
  }

  const temasLimpios = validarTemas(temas)
  if (!temasLimpios) {
    return json({ error: 'Elige al menos un tema válido.' }, 400)
  }

  // Upsert por endpoint: reactivar o cambiar de temas reutiliza la fila.
  await sql`
    INSERT INTO push_suscripciones (endpoint, p256dh, auth, temas)
    VALUES (${endpoint}, ${p256dh}, ${auth}, ${JSON.stringify(temasLimpios)}::jsonb)
    ON CONFLICT (endpoint) DO UPDATE
      SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, temas = EXCLUDED.temas
  `
  return json({ ok: true, temas: temasLimpios })
}
