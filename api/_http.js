// Utilidades compartidas por las Edge Functions (Web API Request/Response).
//
// El guion bajo evita que Vercel lo despliegue como endpoint propio.

/** Respuesta JSON estilo Edge. `headers` extra (p. ej. Set-Cookie) opcionales. */
export const json = (datos, status = 200, headers = {}) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

/**
 * Cuerpo JSON de una Request Edge. En Edge el body es un stream sin parsear
 * (no existe req.body); devuelve {} si viene vacío o malformado, igual que
 * hacía el parseo laxo del middleware de desarrollo.
 */
export async function leerJson(req) {
  try {
    const datos = await req.json()
    return datos ?? {}
  } catch {
    return {}
  }
}

/** Parámetros de la query string de una Request Edge (?id=… → { id }). */
export function queryDe(req) {
  return Object.fromEntries(new URL(req.url).searchParams)
}

/** Lee una cabecera de forma agnóstica (Edge `headers.get` o Node `headers[]`). */
function cabecera(req, nombre) {
  return typeof req.headers?.get === 'function'
    ? req.headers.get(nombre)
    : req.headers?.[nombre]
}

/**
 * Defensa CSRF para peticiones que mutan estado. Devuelve true si la petición
 * es de confianza. Criterio: si viene cabecera `Origin`, su host debe coincidir
 * con el del servidor; si NO viene `Origin` (típico de clientes no-navegador:
 * cron, curl, los `afterAll` de los e2e), se permite —un atacante CSRF actúa
 * SIEMPRE desde un navegador, que sí envía `Origin` en peticiones cross-site.
 * La cookie de sesión es httpOnly+SameSite, así que esto es una capa extra.
 */
export function mismoOrigen(req) {
  const origin = cabecera(req, 'origin')
  if (!origin) return true
  try {
    const hostPeticion =
      cabecera(req, 'host') || (req.url ? new URL(req.url).host : '')
    return new URL(origin).host === hostPeticion
  } catch {
    return false
  }
}

/** Respuesta 403 de CSRF para handlers Edge (Web Response). */
export function rechazoCsrf() {
  return json({ error: 'Origen no permitido.' }, 403)
}

/** ¿La petición muta estado y viene de un origen no permitido? */
export function csrfInvalido(req) {
  const mutante = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
  return mutante && !mismoOrigen(req)
}
