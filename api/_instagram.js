// Helpers compartidos por los dos webhooks de Apify que sincronizan Instagram:
// api/sync-instagram.js (eventos de cultura_navalcarnero) y
// api/sync-instagram-noticias.js (noticias/alertas de ayuntamientonavalcarnero).
// El guion bajo evita que Vercel lo despliegue como endpoint propio.
//
// Solo Node: usa @vercel/blob (undici), que no funciona en el Edge Runtime.
import { put } from '@vercel/blob'

export const TIPOS_IMAGEN = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const MAX_IMAGEN_BYTES = 4 * 1024 * 1024
export const MAX_POSTS = 50

/** Primera foto del post: carrusel (childPosts/images) o imagen única. Los
 * actores de Instagram no coinciden en el nombre del campo, así que se prueban
 * varios (instagram-scraper usa displayUrl/images; otros, imageUrl/thumbnail). */
export function primeraImagen(post) {
  if (Array.isArray(post.images) && post.images[0]) return post.images[0]
  if (Array.isArray(post.childPosts) && post.childPosts[0]?.displayUrl) {
    return post.childPosts[0].displayUrl
  }
  return post.displayUrl || post.imageUrl || post.thumbnailUrl || post.image || ''
}

/** shortCode del post: campo directo o, si el actor no lo da (p. ej.
 * instagram-post-scraper), extraído de la url /p/<code>/ o /reel/<code>/. */
export function shortCodeDe(post) {
  if (typeof post.shortCode === 'string' && post.shortCode.trim()) {
    return post.shortCode.trim()
  }
  const m = String(post.url || '').match(/\/(?:p|reel|tv)\/([^/?#]+)/)
  return m ? m[1] : ''
}

/** Reduce un post de Apify a lo que Claude necesita para decidir. */
export function normalizarPost(post) {
  if (!post || typeof post !== 'object') return null
  const shortCode = shortCodeDe(post)
  const caption = typeof post.caption === 'string' ? post.caption.trim() : ''
  if (!shortCode || !caption) return null
  return {
    shortCode,
    caption,
    // Texto alternativo de la imagen que genera Instagram (OCR del cartel):
    // los posts municipales suelen poner fecha/hora/lugar solo en el cartel,
    // así que sin este campo Claude no puede reconocerlos como eventos.
    alt: typeof post.alt === 'string' ? post.alt.trim() : '',
    // La fecha de publicación ancla las fechas relativas ("este sábado 18").
    publicado: post.timestamp || '',
    url: post.url || `https://www.instagram.com/p/${shortCode}/`,
    imagen: primeraImagen(post),
    usuario: post.ownerUsername || '',
  }
}

/**
 * El webhook de Apify no manda el dataset, solo su id
 * (`resource.defaultDatasetId`): los items se descargan de su API. Para
 * pruebas manuales también se acepta el array de posts directamente en el
 * cuerpo (o en `{posts: [...]}`).
 */
export async function obtenerPosts(body) {
  if (Array.isArray(body)) return body
  if (Array.isArray(body?.posts)) return body.posts

  const datasetId = body?.resource?.defaultDatasetId
  if (!datasetId || !/^[A-Za-z0-9]+$/.test(String(datasetId))) {
    throw new Error(
      'Cuerpo no reconocido: se espera un array de posts, {posts: []} o el payload de webhook de Apify.'
    )
  }

  const cabeceras = {}
  if (process.env.APIFY_TOKEN) {
    cabeceras.Authorization = `Bearer ${process.env.APIFY_TOKEN}`
  }
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json`,
    { headers: cabeceras }
  )
  if (!res.ok) throw new Error(`Apify respondió ${res.status} al leer el dataset ${datasetId}`)
  const items = await res.json()
  if (!Array.isArray(items)) throw new Error('El dataset de Apify no devolvió una lista.')
  return items
}

export const hayCredencialesBlob = () =>
  Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  )

/**
 * Descarga la foto del post y la sube a Blob con nombre determinista
 * (<prefijo>/<shortCode>.<ext>): re-ejecutar el webhook sobrescribe el mismo
 * blob en vez de acumular copias. Devuelve la URL o null (la imagen es
 * opcional: un fallo aquí no descarta el item).
 */
export async function subirImagen(prefijo, shortCode, urlOrigen) {
  if (!urlOrigen || !hayCredencialesBlob()) return null
  try {
    const res = await fetch(urlOrigen)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const tipo = (res.headers.get('content-type') || '').split(';')[0].trim()
    const extension = TIPOS_IMAGEN[tipo]
    if (!extension) throw new Error(`tipo no admitido: ${tipo || 'desconocido'}`)
    const contenido = Buffer.from(await res.arrayBuffer())
    if (contenido.length === 0 || contenido.length > MAX_IMAGEN_BYTES) {
      throw new Error(`tamaño fuera de límite (${contenido.length} bytes)`)
    }
    const { url } = await put(`${prefijo}/${shortCode}.${extension}`, contenido, {
      access: 'public',
      contentType: tipo,
      addRandomSuffix: false,
      allowOverwrite: true,
      // Mismo matiz que api/admin/imagen.js: en local el SDK preferiría OIDC
      // (prohibido en development), así que el token se pasa explícito.
      ...(process.env.BLOB_READ_WRITE_TOKEN
        ? { token: process.env.BLOB_READ_WRITE_TOKEN }
        : {}),
    })
    return url
  } catch (err) {
    console.warn(`Instagram: no se pudo subir la imagen de ${shortCode}: ${err.message}`)
    return null
  }
}
