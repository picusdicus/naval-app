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

    // Primero, elimina todo lo que NO es contenido
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

    // Estrategia 1: Busca div con class "the-content", "post-content", "entry-content"
    let m = limpio.match(/<div[^>]*class="[^"]*(?:the-content|post-content|entry-content|content-area)[^"]*"[^>]*>([\s\S]*?)<\/div>/)
    if (m) {
      contenido = limpiarTexto(m[1], 0)
    }

    // Estrategia 2: Si no, busca el primer div grande (probablemente contenedor principal)
    if (!contenido || contenido.length < 100) {
      const firstBigDiv = limpio.match(/<div[^>]*>([\s\S]{800,}?)<\/div>/)
      if (firstBigDiv) {
        const extracted = limpiarTexto(firstBigDiv[1], 0)
        if (extracted.length > contenido.length) {
          contenido = extracted
        }
      }
    }

    // Estrategia 3: Busca solo párrafos (más seguro, evita ruido)
    if (!contenido || contenido.length < 100) {
      const paragraphs = limpio.match(/<p[^>]*>([\s\S]*?)<\/p>/g) || []
      if (paragraphs.length > 2) {
        // Si hay al menos 3 párrafos, usa esos
        contenido = paragraphs
          .map(p => limpiarTexto(p, 0))
          .filter(t => t.length > 20) // Filtra párrafos muy cortos
          .join('\n\n')
      }
    }

    // Limpia el contenido final: elimina líneas con solo números, calendarios, etc.
    const lineas = contenido.split('\n')
    const linpiasFiltered = lineas.filter(l => {
      const t = l.trim()
      // Rechaza líneas que parecen ser navegación, calendarios, etc.
      return t.length > 10 && !/^\d{1,2}\s+\d{1,2}\s+\d{1,2}$/.test(t) && !t.match(/^[LMX J V SD]+\s*$/)
    })

    contenido = linpiasFiltered.join('\n\n').slice(0, 4000)

    return contenido
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
    const resumen = limpiarTexto(description, 0) // Sin truncar en el fetch, se truncará al mostrar si es necesario

    if (!titulo || !fecha) {
      console.warn(`  ! Salteando: titulo o fecha vacíos`)
      continue
    }

    urlsVistas.add(url)

    // Descarga el contenido completo del artículo
    let contenido = await extraerContenidoArticulo(url)

    // Si el scraping no funcionó bien (contenido muy corto), usa el resumen como fallback
    if (contenido.length < 200) {
      contenido = resumen
    }

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
