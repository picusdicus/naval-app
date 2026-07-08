// Genera src/data/noticias.json descargando el RSS del ayuntamiento:
// https://navalcarnero.es/navalcarnero/prensa/feed/
//
// Extrae de cada artículo: título, fecha publicación, resumen, URL, autor.
// No descarga el contenido completo de cada artículo (se puede añadir luego).
//
// Uso: npm run fetch:noticias

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(__dirname, '../src/data/noticias.json')

const PRENSA_RSS = 'https://navalcarnero.es/navalcarnero/prensa/feed/'
const USER_AGENT = 'NavalcarneroApp/0.1 (proyecto vecinal)'

// ---------------------------------------------------------------------------
// Descarga con deteccion de codificacion
// ---------------------------------------------------------------------------

async function descargarTexto(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())

  // Charset: primero de la cabecera Content-Type; si no, de la declaracion XML.
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

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

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

// Convierte un titulo en MAYUSCULAS a algo mas legible
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

// Clave normalizada para deduplicar por URL
function claveNorm(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Convierte fecha RFC2822 (ej: "Mon, 04 Jun 2026 10:30:00 +0200") a ISO (YYYY-MM-DD)
function fechaISO(rfcDate) {
  if (!rfcDate) return ''
  const d = new Date(rfcDate)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

// Extrae autor del campo <dc:creator> o <author>
function extraerAutor(item) {
  const creator = campoRSS(item, 'dc:creator')
  if (creator) return limpiarTexto(creator, 50)
  const author = campoRSS(item, 'author')
  if (author) return limpiarTexto(author, 50)
  return 'Ayuntamiento'
}

// Extrae el contenido completo de un artículo desde su URL
async function extraerContenidoArticulo(url) {
  try {
    const html = await descargarTexto(url)
    let contenido = ''

    // Busca patrones comunes en sites de WordPress
    // Intenta extraer de div con class que contiene "content" o "post"
    let m = html.match(/<div[^>]*class="[^"]*(?:content|post-content|entry-content|page-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/)

    // Si no, intenta <article>
    if (!m) m = html.match(/<article[^>]*>([\s\S]*?)<\/article>/)

    // Si no, intenta <main>
    if (!m) m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)

    // Si no, busca cualquier div grande después del título
    if (!m) {
      const sinHead = html.split('</header>').pop() || html
      const porcionTexto = sinHead.split('<footer>')[0]
      const bigDiv = porcionTexto.match(/<div[^>]*>([\s\S]{500,})<\/div>/)
      if (bigDiv) m = bigDiv
    }

    if (m) {
      contenido = limpiarTexto(m[1], 0)
    }

    // Si aún está vacío, usa la descripción del RSS como fallback
    return contenido.slice(0, 5000)
  } catch (err) {
    console.warn(`  ! No se pudo descargar contenido de ${url}: ${err.message}`)
    return ''
  }
}

// ---------------------------------------------------------------------------
// Parseo del RSS
// ---------------------------------------------------------------------------

async function obtenerNoticias() {
  console.log('Descargando RSS de Prensa del Ayuntamiento...')
  const xml = await descargarTexto(PRENSA_RSS)

  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
  console.log(`  encontrados ${items.length} elementos`)

  const noticias = []
  const urlsVistas = new Set()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const url = campoRSS(item, 'link')
    if (!url || urlsVistas.has(url)) continue

    const tituloCrudo = decodificarEntidades(campoRSS(item, 'title'))
    const pubDate = campoRSS(item, 'pubDate')
    const description = campoRSS(item, 'description')
    const autor = extraerAutor(item)

    const titulo = tituloLegible(tituloCrudo)
    const fecha = fechaISO(pubDate)
    const resumen = limpiarTexto(description, 220)

    if (!titulo || !fecha) {
      console.warn(`  ! Salteando: titulo o fecha vacíos`)
      continue
    }

    urlsVistas.add(url)

    // Descarga el contenido completo del artículo
    const contenido = await extraerContenidoArticulo(url)

    noticias.push({
      id: `noticias-${claveNorm(titulo.slice(0, 30))}`,
      titulo,
      fecha,
      resumen,
      contenido,
      url,
      autor,
    })

    console.log(`  - ${titulo.slice(0, 60)}`)
  }

  // Ordena por fecha descendente (más recientes primero)
  noticias.sort((a, b) => b.fecha.localeCompare(a.fecha))

  return noticias
}

// ---------------------------------------------------------------------------

async function main() {
  try {
    const noticias = await obtenerNoticias()
    mkdirSync(dirname(SALIDA), { recursive: true })
    writeFileSync(SALIDA, JSON.stringify(noticias, null, 2) + '\n', 'utf8')
    console.log(`✓ Guardadas ${noticias.length} noticias en ${SALIDA}`)
  } catch (err) {
    console.error('✗ Error:', err.message)
    process.exit(1)
  }
}

main()
