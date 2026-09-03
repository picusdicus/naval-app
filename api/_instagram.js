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

// Cada run de Apify reenvía sus ~50 posts más recientes, incluidos los de
// runs anteriores: sin este corte, un post ya procesado hace semanas se
// vuelve a mandar entero a Claude cada día (coste de tokens) y, antes de este
// cambio, también generaba subidas de Blob repetidas. 30 días cubre de sobra
// el ciclo de publicación municipal (nada se anuncia con tanta antelación).
export const MAX_DIAS_ANTIGUEDAD = 30

/**
 * true si el post es reciente (dentro de MAX_DIAS_ANTIGUEDAD) o si no tiene
 * una fecha de publicación parseable — un post sin `timestamp` no se
 * descarta, para no romper el reproceso manual (posts de prueba pasados
 * directamente en el body, que a menudo no llevan esa fecha).
 */
export function esPostReciente(post, maxDias = MAX_DIAS_ANTIGUEDAD) {
  const t = Date.parse(post?.publicado)
  if (!Number.isFinite(t)) return true
  return Date.now() - t <= maxDias * 24 * 3600 * 1000
}

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

/** id estable de una foto de carrusel: Instagram asigna a cada hija de un
 * Sidecar su propio media id/shortcode (independiente del índice y del
 * shortCode del post), así que sobrevive a que el post se reedite y las
 * fotos cambien de orden o de número — a diferencia de emparejar por título,
 * que puede confundir dos actividades con títulos parecidos ("Torneo de
 * Pádel" / "Torneo de Pádel Infantil"). El nombre del campo varía entre
 * actores de Apify (no todos lo exponen igual, o no lo exponen); se prueban
 * los más plausibles y se cae a null si ninguno está — en ese caso el
 * llamador cae a emparejar por título, como antes de este campo. */
function idDeFotoCarrusel(childPost) {
  const c = childPost || {}
  if (typeof c.id === 'string' && c.id) return c.id
  if (typeof c.shortCode === 'string' && c.shortCode) return c.shortCode
  if (typeof c.pk === 'string' && c.pk) return c.pk
  if (typeof c.pk === 'number') return String(c.pk)
  return null
}

/** Pares alt+imagen+id de cada foto del carrusel (childPosts): los carteles
 * municipales llevan una actividad por foto con todos sus datos en el alt
 * (OCR de Instagram) — p. ej. la programación deportiva, un cartel por
 * prueba. El alt del post padre es solo "Photo by …", así que sin esto los
 * carteles interiores son invisibles para la extracción. */
/** Lado mayor de una foto en píxeles según lo que da Apify, o 0 si no lo dice.
 *  La API de Anthropic rechaza la petición ENTERA (400) si en una petición con
 *  varias imágenes alguna pasa de 2000 px de lado, así que saberlo antes de
 *  descargarla es lo que permite dejarla fuera en vez de perder el lote. */
export function ladoMayorDe(foto) {
  if (!foto || typeof foto !== 'object') return 0
  return Math.max(
    Number(foto.dimensionsWidth) || 0,
    Number(foto.dimensionsHeight) || 0,
    Number(foto.originalWidth) || 0,
    Number(foto.originalHeight) || 0
  )
}

export function carruselDe(post) {
  if (!Array.isArray(post.childPosts)) return []
  return post.childPosts
    .map((c) => ({
      alt: typeof c?.alt === 'string' ? c.alt.trim() : '',
      imagen: c?.displayUrl || '',
      id: idDeFotoCarrusel(c),
      // Lado mayor en píxeles, para poder descartar antes de descargarla una
      // foto que la API rechazaría (ver ladoMayorDe).
      lado: ladoMayorDe(c),
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

// Instagram genera esta fórmula fija cuando no tiene nada que decir de la
// foto ("Photo by Ayuntamiento de Navalcarnero on August 03, 2026."). Es el
// alt que trae SIEMPRE el post padre de un carrusel — nunca aporta contenido,
// así que se descarta en vez de mandarlo a Claude como si fuera texto real.
const ALT_GENERICO_RE = /^Photo by .+ on \w+ \d{1,2}, \d{4}\.?$/i

function altUtil(alt) {
  const limpio = typeof alt === 'string' ? alt.trim() : ''
  if (!limpio || ALT_GENERICO_RE.test(limpio)) return ''
  return limpio
}

const MAX_FOTOS_ALT = 10
const MAX_CHARS_ALT = 4000

/**
 * Alt combinado del post: el del padre (si dice algo) más el de cada foto
 * del carrusel (childPosts), marcado con "[Imagen N]" — N es la posición real
 * de la foto en el carrusel, así que un hueco (una foto sin alt útil) no
 * desplaza la numeración de las siguientes. En un post "Sidecar" el alt del
 * padre es siempre la fórmula genérica y el contenido real (fecha, hora,
 * lugar, plazo, precio…) vive en el alt de cada hijo — sin esto, un carrusel
 * municipal (un cartel de actividad por foto) llegaba a Claude prácticamente
 * ciego. En un post de foto única no hay childPosts, así que el resultado es
 * exactamente el alt del padre, como hasta ahora. Limitado a las primeras
 * MAX_FOTOS_ALT fotos y a MAX_CHARS_ALT caracteres para no disparar tokens en
 * carruseles largos.
 */
function altCompletoDe(post) {
  const partes = []
  const altPadre = altUtil(post.alt)
  if (altPadre) partes.push(altPadre)

  if (Array.isArray(post.childPosts)) {
    post.childPosts.slice(0, MAX_FOTOS_ALT).forEach((hijo, indice) => {
      const altHijo = altUtil(hijo?.alt)
      if (altHijo) partes.push(`[Imagen ${indice + 1}] ${altHijo}`)
    })
  }

  let texto = partes.join('\n')
  if (texto.length > MAX_CHARS_ALT) texto = texto.slice(0, MAX_CHARS_ALT).trimEnd() + '…'
  return texto
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
    // Texto alternativo de la(s) imagen(es) que genera Instagram (OCR del
    // cartel): los posts municipales suelen poner fecha/hora/lugar solo en el
    // cartel, así que sin este campo Claude no puede reconocerlos como
    // eventos. En un carrusel esto incluye el alt de cada foto (ver
    // altCompletoDe) — el del post padre por sí solo es siempre la fórmula
    // genérica de Instagram, sin ningún dato del cartel.
    alt: altCompletoDe(post),
    // La fecha de publicación ancla las fechas relativas ("este sábado 18").
    publicado: post.timestamp || '',
    url: post.url || `https://www.instagram.com/p/${shortCode}/`,
    imagen: primeraImagen(post),
    // Lado mayor de la portada, mismo uso que el `lado` de cada foto del
    // carrusel: descartar antes de descargarla una imagen que la API
    // rechazaría en una petición con varias imágenes.
    lado: ladoMayorDe(post),
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

/**
 * Detecta si un alt de Instagram es genérico (sin datos útiles).
 * El alt genérico de Instagram sigue el patrón "Photo by <cuenta> on <fecha>"
 * sin ningún otro contenido — es la fórmula automática que genera Instagram
 * cuando el creador no proporciona una descripción alternativa.
 *
 * Ejemplos reales de alt genérico:
 * - "Photo by Cultura_navalcarnero on August 27, 2026."
 * - "Photo by ayuntamientonavalcarnero on August 20, 2026."
 * - "" (string vacío)
 *
 * Ejemplo de alt útil (NO genérico):
 * - "TARDEO DEPORTIVO AQUAZUMBA CON DJ PIWI 21 DE AGOSTO PISCINA COVADONGA 19:30"
 *   (contiene fecha/hora/lugar reales del evento)
 */
export function esAltGenerico(alt) {
  if (typeof alt !== 'string') return true
  const trimmed = alt.trim()
  if (!trimmed) return true
  // Patrón "Photo by ... on <fecha>": fórmula automática de Instagram, sin
  // ningún dato útil. El autor puede ser el usuario ("Cultura_navalcarnero")
  // o el nombre para mostrar CON ESPACIOS ("Ayuntamiento de Navalcarnero"):
  // con `\w+` (sin espacios) los posts del Ayuntamiento — que son justo los
  // que llevan los datos rotulados en el cartel — se daban por alt ÚTIL, la
  // visión no se activaba nunca para ellos y el triaje los rechazaba en
  // bloque por no encontrar fecha/hora/lugar en ninguna parte.
  //
  // El `\.$` final se mantiene: cuando Instagram añade su descripción
  // ("… 2026. May be an image of text.") el alt SÍ aporta algo y no debe
  // tratarse como genérico.
  if (/^Photo by .{1,100}? on \w+ \d{1,2}, \d{4}\.$/.test(trimmed)) {
    return true
  }
  return false
}
