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
