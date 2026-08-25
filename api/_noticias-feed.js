// Descarga y parseo del RSS de PRENSA del Ayuntamiento
// (https://navalcarnero.es/navalcarnero/prensa/feed/) → array de noticias con
// el shape de src/data/noticias.json (id/titulo/fecha/resumen/contenido/url/autor).
//
// Lo usan dos sitios:
//  - scripts/fetch-noticias.mjs (regeneración manual, escribe el JSON en disco).
//  - api/sync-events.js (el cron diario, que lo commitea a GitHub junto a los
//    eventos — así las noticias de prensa dejan de quedarse rancias).
//
// El guion bajo evita que Vercel lo despliegue como endpoint propio. Node-only
// (usa Buffer/TextDecoder), pero sin dependencias externas.

const PRENSA_RSS = 'https://navalcarnero.es/navalcarnero/prensa/feed/'
const USER_AGENT = 'NavalcarneroApp/0.1 (proyecto vecinal)'

// Cuántos artículos se descargan a la vez para extraer su contenido completo.
// En lotes para no disparar el tiempo de ejecución del cron con ~30 fetches
// secuenciales; cada uno con su propio timeout para que uno lento no cuelgue.
const LOTE_CONTENIDO = 6
const TIMEOUT_ARTICULO_MS = 8000

async function descargarTexto(url, señal) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: señal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())

  // Charset: primero de la cabecera Content-Type; si no, de la declaración XML.
  const ct = res.headers.get('content-type') || ''
  let charset = (ct.match(/charset=([^;]+)/i) || [])[1]
  if (!charset) {
    const head = buf.subarray(0, 1024).toString('latin1')
    charset =
      (head.match(/encoding=["']([^"']+)["']/i) ||
        head.match(/charset=["']?([\w-]+)/i) ||
        [])[1]
  }
  charset = (charset || 'utf-8').toLowerCase().trim()

  try {
    return new TextDecoder(charset).decode(buf)
  } catch {
    return new TextDecoder('utf-8').decode(buf)
  }
}

function decodificarEntidades(txt) {
  return txt
    .replace(/&#8220;|&#8221;|&laquo;|&raquo;|&quot;/g, '"')
    .replace(/&#8217;|&#8216;|&#039;|&apos;/g, "'")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, '–')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function limpiarTexto(html, max = 220) {
  if (!html) return ''
  const txt = decodificarEntidades(String(html).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  if (max && txt.length > max) return txt.slice(0, max - 1).trimEnd() + '…'
  return txt
}

function quitarCDATA(txt) {
  return txt.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '')
}

function campoRSS(itemXml, tag) {
  const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return m ? quitarCDATA(m[1]).trim() : ''
}

const PROPIOS = ['navalcarnero', 'san', 'isidro', 'reyes', 'magos', 'carnaval', 'cabalgata']
function tituloLegible(txt) {
  const base = decodificarEntidades(txt).replace(/\s+/g, ' ').trim()
  const letras = (base.match(/\p{L}/gu) || []).length
  const mays = (base.match(/\p{Lu}/gu) || []).length
  const casiTodoMayus = letras > 0 && mays / letras > 0.7
  let s = casiTodoMayus ? base.toLowerCase() : base
  s = s.replace(/(^|[.!?:]\s+)(\p{Ll})/gu, (_, p, c) => p + c.toUpperCase())
  s = s.replace(/\p{L}+/gu, (w) =>
    PROPIOS.includes(w.toLowerCase()) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w,
  )
  return s
}

function claveNorm(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Fecha RFC2822 ("Mon, 04 Jun 2026 10:30:00 +0200") → ISO (YYYY-MM-DD).
function fechaISO(rfcDate) {
  if (!rfcDate) return ''
  const d = new Date(rfcDate)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function extraerAutor(item) {
  const creator = campoRSS(item, 'dc:creator')
  if (creator) return limpiarTexto(creator, 50)
  const author = campoRSS(item, 'author')
  if (author) return limpiarTexto(author, 50)
  return 'Ayuntamiento'
}

// Contenido completo de un artículo desde su URL (varias estrategias, cae al
// resumen si el scraping no saca nada útil).
async function extraerContenidoArticulo(url) {
  try {
    const html = await descargarTexto(url, AbortSignal.timeout(TIMEOUT_ARTICULO_MS))

    let limpio = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<form[\s\S]*?<\/form>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')

    let contenido = ''

    let m = limpio.match(
      /<div[^>]*class="[^"]*(?:the-content|post-content|entry-content|content-area)[^"]*"[^>]*>([\s\S]*?)<\/div>/,
    )
    if (m) contenido = limpiarTexto(m[1], 0)

    if (!contenido || contenido.length < 100) {
      const firstBigDiv = limpio.match(/<div[^>]*>([\s\S]{800,}?)<\/div>/)
      if (firstBigDiv) {
        const extracted = limpiarTexto(firstBigDiv[1], 0)
        if (extracted.length > contenido.length) contenido = extracted
      }
    }

    if (!contenido || contenido.length < 100) {
      const paragraphs = limpio.match(/<p[^>]*>([\s\S]*?)<\/p>/g) || []
      if (paragraphs.length > 2) {
        contenido = paragraphs
          .map((p) => limpiarTexto(p, 0))
          .filter((t) => t.length > 20)
          .join('\n\n')
      }
    }

    const lineas = contenido.split('\n')
    const filtradas = lineas.filter((l) => {
      const t = l.trim()
      return t.length > 10 && !/^\d{1,2}\s+\d{1,2}\s+\d{1,2}$/.test(t) && !t.match(/^[LMX J V SD]+\s*$/)
    })

    return filtradas.join('\n\n').slice(0, 4000)
  } catch (err) {
    console.warn(`Noticias: no se pudo descargar contenido de ${url}: ${err.message}`)
    return ''
  }
}

/** Descarga y parsea el feed de prensa. Devuelve las noticias ordenadas por
 * fecha descendente, con contenido completo (fallback al resumen). */
export async function obtenerNoticiasPrensa() {
  const xml = await descargarTexto(PRENSA_RSS)
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []

  // 1) Base de cada noticia (sin contenido todavía), deduplicada por URL.
  const bases = []
  const urlsVistas = new Set()
  for (const item of items) {
    const url = campoRSS(item, 'link')
    if (!url || urlsVistas.has(url)) continue

    const titulo = tituloLegible(decodificarEntidades(campoRSS(item, 'title')))
    const fecha = fechaISO(campoRSS(item, 'pubDate'))
    if (!titulo || !fecha) continue

    urlsVistas.add(url)
    bases.push({
      id: `noticias-${claveNorm(titulo.slice(0, 30))}`,
      titulo,
      fecha,
      resumen: limpiarTexto(campoRSS(item, 'description'), 0),
      url,
      autor: extraerAutor(item),
    })
  }

  // 2) Contenido completo en lotes (uno lento no bloquea al resto).
  const noticias = []
  for (let i = 0; i < bases.length; i += LOTE_CONTENIDO) {
    const trozo = bases.slice(i, i + LOTE_CONTENIDO)
    const contenidos = await Promise.all(trozo.map((b) => extraerContenidoArticulo(b.url)))
    trozo.forEach((b, j) => {
      const contenido = contenidos[j].length >= 200 ? contenidos[j] : b.resumen
      noticias.push({
        id: b.id,
        titulo: b.titulo,
        fecha: b.fecha,
        resumen: b.resumen,
        contenido,
        url: b.url,
        autor: b.autor,
      })
    })
  }

  // Sin guarda de fecha null a propósito: toda noticia viene de `bases`, y el
  // paso 1 descarta cualquier item sin fecha parseable (`if (!titulo || !fecha)
  // continue` — fechaISO() devuelve '' si el pubDate falta o no parsea). Esta
  // función solo procesa el RSS de prensa; las noticias de Instagram viven en
  // Neon y se ordenan aparte en useNoticiasPublicas (ese sort sí lleva guarda).
  noticias.sort((a, b) => b.fecha.localeCompare(a.fecha))
  return noticias
}
