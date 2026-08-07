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

/** Todas las fotos del post, en orden de carrusel (o una sola si no lo es).
 * Mismo baile de campos entre actores que primeraImagen(): un carrusel real
 * (type "Sidecar") trae varias entradas en `images`/`childPosts`; si no,
 * cae a la imagen única. Se usa para no perder el resto de fotos de un post
 * como el de instalaciones deportivas (una foto por instalación). */
export function todasLasImagenes(post) {
  if (Array.isArray(post.images) && post.images.length > 0) {
    const urls = post.images.filter(Boolean)
    if (urls.length > 0) return urls
  }
  if (Array.isArray(post.childPosts) && post.childPosts.length > 0) {
    const urls = post.childPosts.map((c) => c?.displayUrl).filter(Boolean)
    if (urls.length > 0) return urls
  }
  const unica = primeraImagen(post)
  return unica ? [unica] : []
}

/** Pares alt+imagen de cada foto del carrusel (childPosts): los carteles
 * municipales llevan una actividad por foto con todos sus datos en el alt
 * (OCR de Instagram) — p. ej. la programación deportiva, un cartel por
 * prueba. El alt del post padre es solo "Photo by …", así que sin esto los
 * carteles interiores son invisibles para la extracción. */
export function carruselDe(post) {
  if (!Array.isArray(post.childPosts)) return []
  return post.childPosts
    .map((c) => ({
      alt: typeof c?.alt === 'string' ? c.alt.trim() : '',
      imagen: c?.displayUrl || '',
    }))
    // Con la extracción por visión basta la imagen; el alt (OCR de
    // Instagram) queda como apoyo/fallback si la descarga falla.
    .filter((c) => c.alt || c.imagen)
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
    // Todas las fotos del post (carrusel completo); imagen sigue siendo solo
    // la primera, para no tocar nada de lo que ya consume ese campo.
    imagenes: todasLasImagenes(post),
    // alt+imagen por cartel del carrusel (para extraer una actividad por foto).
    carrusel: carruselDe(post),
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

// ——— Atribución por autor (compartida por los dos webhooks) ———
// ownerUsername del post → organización de la agenda auto-provisionada (el
// "Organiza" de la ficha y la `fuente` del GET público salen de su nombre).
// Los posts en colaboración aparecen con el ownerUsername del coautor:
// mientras no tengan entrada propia, caen al fallback de cultura.
export const ORG_CULTURA = {
  nombre: 'Cultura Navalcarnero',
  slug: 'cultura-navalcarnero',
  descripcion:
    'Eventos publicados en Instagram por cultura_navalcarnero y sincronizados automáticamente.',
  categoriaDefecto: 'cultura',
  lugarDefecto: 'Navalcarnero',
}

// El slug 'ayuntamiento' coincide con ORG_POR_FUENTE/ORGANIZADORES_FIJOS de
// src/lib/temasPush.js: los eventos quedan bajo el tema org:ayuntamiento ya
// existente en el selector de avisos.
export const ORG_AYUNTAMIENTO = {
  nombre: 'Ayuntamiento de Navalcarnero',
  slug: 'ayuntamiento',
  descripcion:
    'Eventos publicados en Instagram por ayuntamientonavalcarnero y sincronizados automáticamente.',
  categoriaDefecto: 'cultura',
  lugarDefecto: 'Navalcarnero',
}

const ORG_POR_USUARIO = {
  cultura_navalcarnero: ORG_CULTURA,
  ayuntamientonavalcarnero: ORG_AYUNTAMIENTO,
}

export function orgDeUsuario(usuario) {
  return ORG_POR_USUARIO[String(usuario || '').toLowerCase()] || ORG_CULTURA
}

/** Auto-provisiona (idempotente) la organización de un autor; devuelve su id. */
export async function asegurarOrganizacion(sql, org) {
  const filas = await sql`
    INSERT INTO organizaciones (nombre, slug, descripcion, categoria_defecto, lugar_defecto, activa)
    VALUES (${org.nombre}, ${org.slug}, ${org.descripcion},
            ${org.categoriaDefecto}, ${org.lugarDefecto}, true)
    ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre
    RETURNING id
  `
  return filas[0].id
}

export const hayCredencialesBlob = () =>
  Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  )

/**
 * Descarga la foto del post y la sube a Blob con nombre determinista
 * (<prefijo>/<shortCode>.<ext>, o <prefijo>/<shortCode>-<sufijo>.<ext> si se
 * pasa `sufijo`): re-ejecutar el webhook sobrescribe el mismo blob en vez de
 * acumular copias. El sufijo permite subir el resto de fotos de un carrusel
 * sin tocar el nombre histórico de la primera (sufijo vacío = comportamiento
 * de siempre). Devuelve la URL o null (la imagen es opcional: un fallo aquí
 * no descarta el item).
 */
export async function subirImagen(prefijo, shortCode, urlOrigen, sufijo = '') {
  // Sin credenciales: devolver URL original como fallback
  if (!urlOrigen) return null
  if (!hayCredencialesBlob()) return urlOrigen
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
    const nombre = sufijo ? `${prefijo}/${shortCode}-${sufijo}.${extension}` : `${prefijo}/${shortCode}.${extension}`
    const { url } = await put(nombre, contenido, {
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
