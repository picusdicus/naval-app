// Genera src/data/eventos-externos.json combinando dos fuentes reales de la
// agenda cultural de Navalcarnero, sin duplicados y con el mismo shape:
//
//   1. Teatro TYL TYL - API publica (plugin The Events Calendar).
//   2. Concejalia de Cultura del Ayuntamiento - RSS de WordPress. De cada
//      entrada se entra en su URL para leer la foto real (og:image) y se usa
//      el cuerpo del post como descripcion completa.
//
// Uso: npm run fetch:eventos
//
// No toca src/data/eventos.json (eventos curados a mano). La app (Eventos,
// Inicio) y el asistente combinan eventos curados + externos.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(__dirname, '../src/data/eventos-externos.json')

const TYLTYL_API = 'https://www.tyltyl.org/wp-json/tribe/events/v1/events'
const CULTURA_RSS = 'https://www.navalcarnero.es/navalcarnero/cultura/feed/'

const USER_AGENT = 'NavalcarneroApp/0.1 (proyecto vecinal)'

// ---------------------------------------------------------------------------
// Descarga con deteccion de codificacion (evita mojibake si una fuente sirve
// el contenido en ISO-8859-1 / Windows-1252 en lugar de UTF-8).
// ---------------------------------------------------------------------------

async function descargarTexto(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())

  // Charset: primero de la cabecera Content-Type; si no, de la declaracion
  // <?xml encoding=...?> o <meta charset=...> al inicio del documento.
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

// Decodifica las entidades HTML mas comunes que aparecen en los feeds.
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

// Limpia HTML: quita etiquetas y entidades, colapsa espacios y recorta.
function limpiarTexto(html, max = 220) {
  if (!html) return ''
  const txt = decodificarEntidades(String(html).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  if (max && txt.length > max) return txt.slice(0, max - 1).trimEnd() + '…'
  return txt
}

// "2026-09-15 18:00:00" -> { fecha: "2026-09-15", hora: "18:00" }
function partesFecha(startDate, allDay) {
  const [fecha, hora] = String(startDate || '').split(' ')
  return { fecha: fecha || '', hora: allDay ? '' : hora ? hora.slice(0, 5) : '' }
}

// Convierte un titulo en MAYUSCULAS a algo legible (frase con mayuscula
// inicial y tras signos de puntuacion), recuperando algunos nombres propios.
const PROPIOS = ['navalcarnero', 'san', 'isidro', 'reyes', 'magos', 'carnaval', 'cabalgata']
function tituloLegible(txt) {
  const base = decodificarEntidades(txt).replace(/\s+/g, ' ').trim()
  // Si no esta practicamente todo en mayusculas, se respeta tal cual.
  const letras = (base.match(/\p{L}/gu) || []).length
  const mays = (base.match(/\p{Lu}/gu) || []).length
  const casiTodoMayus = letras > 0 && mays / letras > 0.7
  let s = casiTodoMayus ? base.toLowerCase() : base
  // Mayuscula inicial y tras . ! ? :
  s = s.replace(/(^|[.!?:]\s+)(\p{Ll})/gu, (_, p, c) => p + c.toUpperCase())
  // Recupera nombres propios frecuentes.
  s = s.replace(/\p{L}+/gu, (w) =>
    PROPIOS.includes(w.toLowerCase()) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w,
  )
  return s
}

// Clave normalizada (sin acentos, minusculas, sin puntuacion) para deduplicar.
function claveNorm(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Parseo de fechas en espanol (el RSS trae la fecha en el titulo/cuerpo)
// ---------------------------------------------------------------------------

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

function normalizarMes(nombre) {
  const n = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  return MESES[n] || null
}

// Busca un (dia, mes) en un texto en espanol. Prioriza rangos "del X al Y de MES".
function extraerDiaMes(texto) {
  const t = texto.toLowerCase()
  // "del 27 de mayo al 9 de junio" o "del 16 al 26 de junio"
  let m = t.match(/del\s+(\d{1,2})(?:\s+de\s+(\p{L}+))?\s+al\s+\d{1,2}\s+de\s+(\p{L}+)/u)
  if (m) {
    const mes = normalizarMes(m[2] || m[3])
    if (mes) return { dia: parseInt(m[1], 10), mes }
  }
  // "12 de mayo", "martes 16 de junio"
  m = t.match(/(\d{1,2})\s+de\s+(\p{L}+)/u)
  if (m) {
    const mes = normalizarMes(m[2])
    if (mes) return { dia: parseInt(m[1], 10), mes }
  }
  return null
}

// Busca una hora "18:00h", "a las 19:00", "20.30h" en el texto.
function extraerHora(texto) {
  let m = texto.match(/a\s+las\s+(\d{1,2})(?:[:.](\d{2}))?/i)
  if (!m) m = texto.match(/(\d{1,2})[:.](\d{2})\s*h/i)
  if (!m) return ''
  const hh = String(parseInt(m[1], 10)).padStart(2, '0')
  const mm = m[2] ? m[2] : '00'
  return `${hh}:${mm}`
}

// Lugar: si el cuerpo menciona un espacio conocido, lo usa; si no, Navalcarnero.
const LUGARES = [
  [/casa de la cultura/i, 'Casa de la Cultura'],
  [/sala de exposiciones/i, 'Sala de Exposiciones'],
  [/teatro municipal/i, 'Teatro Municipal'],
  [/plaza de segovia/i, 'Plaza de Segovia'],
  [/auditorio/i, 'Auditorio Municipal'],
  [/biblioteca/i, 'Biblioteca Municipal'],
]
function extraerLugar(texto) {
  for (const [re, nombre] of LUGARES) if (re.test(texto)) return nombre
  return 'Navalcarnero'
}

// Construye la fecha ISO a partir del dia/mes extraidos y un anyo de referencia
// (el de publicacion). Si el evento cae bastante antes de la publicacion, se
// asume el anyo siguiente (tipico en anuncios de diciembre para enero).
function fechaISO(dia, mes, refDate, textoAnyo) {
  const anyoExplicito = (textoAnyo.match(/\b(20\d{2})\b/) || [])[1]
  let anyo = anyoExplicito ? parseInt(anyoExplicito, 10) : refDate.getUTCFullYear()
  if (!anyoExplicito) {
    const cand = Date.UTC(anyo, mes - 1, dia)
    const ref = refDate.getTime()
    if (cand < ref - 60 * 24 * 3600 * 1000) anyo += 1
  }
  const mm = String(mes).padStart(2, '0')
  const dd = String(dia).padStart(2, '0')
  return `${anyo}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Fuente 1: Teatro TYL TYL (API The Events Calendar)
// ---------------------------------------------------------------------------

async function traerPaginaTyltyl(page) {
  const url = `${TYLTYL_API}?per_page=50&page=${page}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`TYL TYL API respondio ${res.status}`)
  return res.json()
}

async function eventosTyltyl() {
  const eventos = []
  let page = 1
  let totalPaginas = 1
  do {
    const data = await traerPaginaTyltyl(page)
    totalPaginas = data.total_pages || 1
    for (const ev of data.events || []) {
      const { fecha, hora } = partesFecha(ev.start_date, ev.all_day)
      if (!fecha) continue
      const lugar = ev.venue && ev.venue.venue ? limpiarTexto(ev.venue.venue, 80) : 'Teatro TYL TYL'
      eventos.push({
        id: `tyltyl-${ev.id}`,
        titulo: limpiarTexto(ev.title, 120),
        fecha,
        hora,
        lugar,
        categoria: 'cultura',
        origen: 'cultural',
        descripcion: limpiarTexto(ev.excerpt || ev.description, 220),
        url: ev.url || '',
        imagen: ev.image && ev.image.url ? ev.image.url : '',
        fuente: 'TYL TYL',
      })
    }
    page += 1
  } while (page <= totalPaginas)
  return eventos
}

// ---------------------------------------------------------------------------
// Fuente 2: RSS de Cultura del Ayuntamiento
// ---------------------------------------------------------------------------

function quitarCDATA(txt) {
  return txt.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '')
}

function campoRSS(itemXml, tag) {
  const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return m ? quitarCDATA(m[1]).trim() : ''
}

// Extrae un meta og:* / twitter:* del HTML, tolerando el orden de atributos.
function metaEtiqueta(html, prop) {
  const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i')
  const t = html.match(tag)
  if (!t) return ''
  const c = t[0].match(/content=["']([^"']*)["']/i)
  return c ? c[1] : ''
}

// Entra en la URL del evento y devuelve { imagen, descripcion } reales.
async function enriquecerDesdeUrl(url, cuerpoFallback) {
  try {
    const html = await descargarTexto(url)
    let imagen = metaEtiqueta(html, 'og:image') || metaEtiqueta(html, 'twitter:image')
    if (imagen) imagen = new URL(imagen, url).href
    // Descripcion completa: cuerpo del post (content:encoded); si no, og:description.
    const ogDesc = limpiarTexto(metaEtiqueta(html, 'og:description'), 1200)
    const descripcion = limpiarTexto(cuerpoFallback, 1200) || ogDesc
    return { imagen, descripcion }
  } catch (err) {
    console.warn(`  ! No se pudo enriquecer ${url}: ${err.message}`)
    return { imagen: '', descripcion: limpiarTexto(cuerpoFallback, 1200) }
  }
}

// Convierte un <item> del RSS en un evento con el shape comun (o null si no
// tiene enlace). `indice` solo se usa como respaldo para el id.
async function procesarItem(item, indice) {
  const tituloCrudo = decodificarEntidades(campoRSS(item, 'title'))
  const url = campoRSS(item, 'link')
  const pubDate = campoRSS(item, 'pubDate')
  const cuerpo = campoRSS(item, 'content:encoded') || campoRSS(item, 'description')
  if (!url) return null

  const refDate = pubDate ? new Date(pubDate) : new Date()
  const textoParaFecha = `${tituloCrudo} ${limpiarTexto(cuerpo, 0)}`

  // Fecha del evento: del titulo/cuerpo; si no se reconoce, la de publicacion.
  const dm = extraerDiaMes(textoParaFecha)
  let fecha
  if (dm) {
    fecha = fechaISO(dm.dia, dm.mes, refDate, textoParaFecha)
  } else if (!isNaN(refDate.getTime())) {
    fecha = refDate.toISOString().slice(0, 10)
  } else {
    return null
  }

  console.log(`  - ${tituloCrudo.slice(0, 60)}`)
  const { imagen, descripcion } = await enriquecerDesdeUrl(url, cuerpo)

  return {
    id: `aytocult-${(url.match(/cultura\/([^/]+)\/?$/) || [])[1] || indice}`,
    titulo: tituloLegible(tituloCrudo),
    fecha,
    hora: extraerHora(textoParaFecha),
    lugar: extraerLugar(limpiarTexto(cuerpo, 0)),
    categoria: 'cultura',
    origen: 'cultural',
    descripcion,
    url,
    imagen,
    fuente: 'Ayuntamiento',
  }
}

// Recorre el feed pagina a pagina (?paged=N). Sigue pidiendo paginas mientras
// la ultima traiga algun evento FUTURO (podria haber mas eventos futuros sin
// importar en la siguiente). Se detiene al dejar de aparecer eventos futuros,
// al agotarse las paginas o al alcanzar el tope de seguridad.
async function eventosCulturaAyto() {
  const HOY = new Date()
  HOY.setHours(0, 0, 0, 0)
  const MAX_PAGINAS = 8

  const eventos = []
  const urlsVistas = new Set()

  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const url = page === 1 ? CULTURA_RSS : `${CULTURA_RSS}?paged=${page}`
    let xml
    try {
      xml = await descargarTexto(url)
    } catch (err) {
      if (page === 1) throw err
      break // fin de la paginacion (p. ej. 404 en la ultima pagina)
    }

    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
    if (!items.length) break

    let nuevosEnPagina = 0
    let futurosEnPagina = 0
    for (const item of items) {
      const ev = await procesarItem(item, eventos.length)
      if (!ev || urlsVistas.has(ev.url)) continue
      urlsVistas.add(ev.url)
      eventos.push(ev)
      nuevosEnPagina++
      if (new Date(`${ev.fecha}T00:00:00`) >= HOY) futurosEnPagina++
    }

    // Si esta pagina no aporto nada nuevo, no tiene sentido seguir.
    if (!nuevosEnPagina) break
    // Solo seguimos a la siguiente pagina si aun aparecen eventos futuros.
    if (!futurosEnPagina) break
  }

  return eventos
}

// ---------------------------------------------------------------------------
// Combinacion sin duplicados
// ---------------------------------------------------------------------------

function combinarSinDuplicados(...listas) {
  const vistos = new Set()
  const resultado = []
  for (const ev of listas.flat()) {
    // Clave por URL (mas fiable) y, como respaldo, por titulo + fecha.
    const claveUrl = ev.url ? `url:${ev.url}` : null
    const claveTF = `tf:${claveNorm(ev.titulo)}|${ev.fecha}`
    if ((claveUrl && vistos.has(claveUrl)) || vistos.has(claveTF)) continue
    if (claveUrl) vistos.add(claveUrl)
    vistos.add(claveTF)
    resultado.push(ev)
  }
  return resultado
}

// ---------------------------------------------------------------------------

async function main() {
  console.log('Consultando la agenda de TYL TYL...')
  let tyltyl = []
  try {
    tyltyl = await eventosTyltyl()
    console.log(`  ${tyltyl.length} eventos de TYL TYL`)
  } catch (err) {
    console.warn(`  ! TYL TYL fallo: ${err.message}`)
  }

  console.log('Consultando el RSS de Cultura del Ayuntamiento...')
  let cultura = []
  try {
    cultura = await eventosCulturaAyto()
    console.log(`  ${cultura.length} eventos del Ayuntamiento`)
  } catch (err) {
    console.warn(`  ! RSS de Cultura fallo: ${err.message}`)
  }

  const eventos = combinarSinDuplicados(tyltyl, cultura)
  eventos.sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''),
  )

  mkdirSync(dirname(SALIDA), { recursive: true })
  writeFileSync(SALIDA, JSON.stringify(eventos, null, 2) + '\n', 'utf8')
  console.log(`Guardados ${eventos.length} eventos externos en ${SALIDA}`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
