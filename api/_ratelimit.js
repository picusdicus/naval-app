// Rate-limiting compartido sobre Upstash Redis (REST). Sirve a handlers Edge y
// Node: solo usa `fetch` y lee cabeceras de forma agnóstica. El guion bajo evita
// que Vercel lo despliegue como endpoint.
//
// Ventana fija por clave: SET key 0 EX ventana NX (crea la clave con caducidad
// solo si no existe) + INCR (cuenta el intento). Una sola llamada HTTP (pipeline).
//
// Estrategia ante fallo: FAIL-OPEN. Si Upstash no está configurado (p. ej. en
// `npm run dev`) o la petición falla, se deja pasar y se registra el error. Para
// una app de servicio, la disponibilidad del login pesa más que el rate-limit;
// la protección real depende de que Upstash esté sano en producción.

import { json } from './_http.js'

/** IP del cliente, agnóstica de runtime (Edge `headers.get` o Node `headers[]`). */
export function obtenerIp(req) {
  const xff =
    typeof req.headers?.get === 'function'
      ? req.headers.get('x-forwarded-for')
      : req.headers?.['x-forwarded-for']
  return (xff || '').split(',')[0].trim() || 'desconocida'
}

function configurado() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Registra un intento contra `clave` y decide si está dentro del límite.
 * Devuelve { ok, restantes, resetEnS }. Ante cualquier problema, { ok: true }.
 *
 * @param {{clave: string, limite: number, ventanaS: number}} opciones
 */
export async function limitar({ clave, limite, ventanaS }) {
  if (!configurado()) {
    // Sin Upstash (típico en desarrollo): no limitamos, sin ruido en logs.
    return { ok: true, restantes: limite, resetEnS: 0 }
  }

  const url = `${process.env.UPSTASH_REDIS_REST_URL.replace(/\/+$/, '')}/pipeline`
  const cuerpo = [
    ['SET', clave, '0', 'EX', String(ventanaS), 'NX'],
    ['INCR', clave],
    ['PTTL', clave],
  ]

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
    })
    if (!res.ok) {
      console.error('Rate-limit: Upstash respondió', res.status)
      return { ok: true, restantes: limite, resetEnS: 0 }
    }
    const datos = await res.json()
    // Pipeline devuelve un array [{result}, {result}, {result}].
    const cuenta = Number(datos?.[1]?.result ?? 0)
    const ttlMs = Number(datos?.[2]?.result ?? 0)
    const resetEnS = ttlMs > 0 ? Math.ceil(ttlMs / 1000) : ventanaS
    return { ok: cuenta <= limite, restantes: Math.max(0, limite - cuenta), resetEnS }
  } catch (error) {
    console.error('Rate-limit: fallo al consultar Upstash:', error)
    return { ok: true, restantes: limite, resetEnS: 0 }
  }
}

/** Respuesta 429 para handlers Edge (Web Response). */
export function respuesta429(resetEnS = 60) {
  return json(
    { error: 'Demasiadas peticiones. Espera un momento antes de volver a intentarlo.' },
    429,
    { 'Retry-After': String(resetEnS) }
  )
}
