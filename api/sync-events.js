import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '../src/data')
const EVENTOS_EXTERNOS_PATH = resolve(DATA_DIR, 'eventos-externos.json')

const TYLTYL_API = 'https://www.tyltyl.org/wp-json/tribe/events/v1/events'
const CULTURA_RSS = 'https://www.navalcarnero.es/navalcarnero/cultura/feed/'
const USER_AGENT = 'NavalcarneroApp/0.1 (proyecto vecinal)'

// Leer el JSON actual para comparación
function leerEventosActuales() {
  try {
    return JSON.parse(readFileSync(EVENTOS_EXTERNOS_PATH, 'utf8'))
  } catch {
    return []
  }
}

// Descargar con detección de codificación
async function descargarTexto(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())

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

// Decodificar entidades HTML
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

// Limpiar texto
function limpiarTexto(html, max = 220) {
  if (!html) return ''
  const txt = decodificarEntidades(String(html).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  if (max && txt.length > max) return txt.slice(0, max - 1).trimEnd() + '…'
  return txt
}

// Partes de fecha
function partesFecha(startDate, allDay) {
  const [fecha, hora] = String(startDate || '').split(' ')
  return { fecha: fecha || '', hora: allDay ? '' : hora ? hora.slice(0, 5) : '' }
}

// Título legible
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

// Clave normalizada
function claveNorm(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Meses en español
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

// Extraer día/mes del texto
function extraerDiaMes(texto) {
  const t = texto.toLowerCase()
  let m = t.match(/del\s+(\d{1,2})(?:\s+de\s+(\p{L}+))?\s+al\s+\d{1,2}\s+de\s+(\p{L}+)/u)
  if (m) {
    const mes = normalizarMes(m[2] || m[3])
    if (mes) return { dia: parseInt(m[1], 10), mes }
  }
  m = t.match(/(\d{1,2})\s+de\s+(\p{L}+)/u)
  if (m) {
    const mes = normalizarMes(m[2])
    if (mes) return { dia: parseInt(m[1], 10), mes }
  }
  return null
}

// Extraer hora
function extraerHora(texto) {
  let m = texto.match(/a\s+las\s+(\d{1,2})(?:[:.](\d{2}))?/i)
  if (!m) m = texto.match(/(\d{1,2})[:.](\d{2})\s*h/i)
  if (!m) return ''
  const hh = String(parseInt(m[1], 10)).padStart(2, '0')
  const mm = m[2] ? m[2] : '00'
  return `${hh}:${mm}`
}

// Extraer lugar
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

// Fecha ISO
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

// TYL TYL API
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

// RSS - utilidades
function quitarCDATA(txt) {
  return txt.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '')
}

function campoRSS(itemXml, tag) {
  const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return m ? quitarCDATA(m[1]).trim() : ''
}

function metaEtiqueta(html, prop) {
  const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i')
  const t = html.match(tag)
  if (!t) return ''
  const c = t[0].match(/content=["']([^"']*)["']/i)
  return c ? c[1] : ''
}

// Enriquecer desde URL
async function enriquecerDesdeUrl(url, cuerpoFallback) {
  try {
    const html = await descargarTexto(url)
    let imagen = metaEtiqueta(html, 'og:image') || metaEtiqueta(html, 'twitter:image')
    if (imagen) imagen = new URL(imagen, url).href
    const ogDesc = limpiarTexto(metaEtiqueta(html, 'og:description'), 1200)
    const descripcion = limpiarTexto(cuerpoFallback, 1200) || ogDesc
    return { imagen, descripcion }
  } catch {
    return { imagen: '', descripcion: limpiarTexto(cuerpoFallback, 1200) }
  }
}

// Procesar item RSS
async function procesarItem(item, indice) {
  const tituloCrudo = decodificarEntidades(campoRSS(item, 'title'))
  const url = campoRSS(item, 'link')
  const pubDate = campoRSS(item, 'pubDate')
  const cuerpo = campoRSS(item, 'content:encoded') || campoRSS(item, 'description')
  if (!url) return null

  const refDate = pubDate ? new Date(pubDate) : new Date()
  const textoParaFecha = `${tituloCrudo} ${limpiarTexto(cuerpo, 0)}`

  const dm = extraerDiaMes(textoParaFecha)
  let fecha
  if (dm) {
    fecha = fechaISO(dm.dia, dm.mes, refDate, textoParaFecha)
  } else if (!isNaN(refDate.getTime())) {
    fecha = refDate.toISOString().slice(0, 10)
  } else {
    return null
  }

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

// RSS de Cultura del Ayuntamiento
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
      break
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

    if (!nuevosEnPagina) break
    if (!futurosEnPagina) break
  }

  return eventos
}

// Combinar sin duplicados
function combinarSinDuplicados(...listas) {
  const vistos = new Set()
  const resultado = []
  for (const ev of listas.flat()) {
    const claveUrl = ev.url ? `url:${ev.url}` : null
    const claveTF = `tf:${claveNorm(ev.titulo)}|${ev.fecha}`
    if ((claveUrl && vistos.has(claveUrl)) || vistos.has(claveTF)) continue
    if (claveUrl) vistos.add(claveUrl)
    vistos.add(claveTF)
    resultado.push(ev)
  }
  return resultado
}

// Hacer commit a GitHub si hay cambios
async function hacerCommitSiHayCambios(eventosPrevios, eventosNuevos) {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    console.log('⚠️  No se pudo hacer commit: falta GITHUB_TOKEN o GITHUB_REPO')
    return false
  }

  const prevJson = JSON.stringify(eventosPrevios, null, 2)
  const newJson = JSON.stringify(eventosNuevos, null, 2)

  if (prevJson === newJson) {
    console.log('✓ Sin cambios en eventos-externos.json')
    return false
  }

  const [owner, repo] = process.env.GITHUB_REPO.split('/')

  try {
    // Obtener ref actual de main
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`,
      {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    )
    if (!refRes.ok) throw new Error(`No se pudo obtener ref de main: ${refRes.status}`)
    const refData = await refRes.json()
    const mainSha = refData.object.sha

    // Obtener el commit actual
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${mainSha}`,
      {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    )
    if (!commitRes.ok) throw new Error(`No se pudo obtener commit: ${commitRes.status}`)
    const commitData = await commitRes.json()
    const treeSha = commitData.tree.sha

    // Crear blob para el nuevo archivo
    const blobRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          content: newJson,
          encoding: 'utf-8',
        }),
      },
    )
    if (!blobRes.ok) throw new Error(`No se pudo crear blob: ${blobRes.status}`)
    const blobData = await blobRes.json()

    // Crear nuevo árbol con el blob actualizado
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          base_tree: treeSha,
          tree: [
            {
              path: 'src/data/eventos-externos.json',
              mode: '100644',
              type: 'blob',
              sha: blobData.sha,
            },
          ],
        }),
      },
    )
    if (!treeRes.ok) throw new Error(`No se pudo crear árbol: ${treeRes.status}`)
    const treeData = await treeRes.json()

    // Crear nuevo commit
    const now = new Date().toISOString()
    const newCommitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: `chore: sync events from external sources at ${now}`,
          tree: treeData.sha,
          parents: [mainSha],
        }),
      },
    )
    if (!newCommitRes.ok) throw new Error(`No se pudo crear commit: ${newCommitRes.status}`)
    const newCommitData = await newCommitRes.json()

    // Actualizar ref de main
    const updateRefRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          sha: newCommitData.sha,
          force: false,
        }),
      },
    )
    if (!updateRefRes.ok) throw new Error(`No se pudo actualizar ref: ${updateRefRes.status}`)

    console.log('✓ Commit realizado a GitHub')
    return true
  } catch (err) {
    console.error('❌ Error al hacer commit:', err.message)
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }

  // Verificar token de cron de Vercel (opcional pero recomendado)
  const cronSecret = req.headers['x-vercel-cron-secret']
  if (cronSecret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Cron secret inválido' })
    return
  }

  const resultado = {
    timestamp: new Date().toISOString(),
    agregados: 0,
    actualizados: 0,
    eliminados: 0,
    errores: [],
  }

  try {
    // Leer eventos actuales
    const eventosPrevios = leerEventosActuales()

    // Descargar nuevos eventos de ambas fuentes
    let tyltyl = []
    let cultura = []

    try {
      tyltyl = await eventosTyltyl()
      resultado.estadisticas = { ...resultado.estadisticas, tyltyl: tyltyl.length }
    } catch (err) {
      resultado.errores.push(`TYL TYL: ${err.message}`)
    }

    try {
      cultura = await eventosCulturaAyto()
      resultado.estadisticas = { ...resultado.estadisticas, cultura: cultura.length }
    } catch (err) {
      resultado.errores.push(`Cultura Ayto: ${err.message}`)
    }

    // Combinar sin duplicados
    const eventosNuevos = combinarSinDuplicados(tyltyl, cultura)
    eventosNuevos.sort(
      (a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''),
    )

    // Calcular cambios
    const idsAnteriores = new Set(eventosPrevios.map((e) => e.id))
    const idsNuevos = new Set(eventosNuevos.map((e) => e.id))

    resultado.agregados = Array.from(idsNuevos).filter((id) => !idsAnteriores.has(id)).length
    resultado.eliminados = Array.from(idsAnteriores).filter((id) => !idsNuevos.has(id)).length

    // Contar actualizados (mismo id, datos distintos)
    for (const eventoPrevio of eventosPrevios) {
      if (idsNuevos.has(eventoPrevio.id)) {
        const eventoNuevo = eventosNuevos.find((e) => e.id === eventoPrevio.id)
        if (JSON.stringify(eventoPrevio) !== JSON.stringify(eventoNuevo)) {
          resultado.actualizados++
        }
      }
    }

    // Escribir JSON (siempre, para asegurar que está up-to-date)
    writeFileSync(EVENTOS_EXTERNOS_PATH, JSON.stringify(eventosNuevos, null, 2) + '\n', 'utf8')

    // Hacer commit a GitHub si hay cambios
    const commitRealizado = await hacerCommitSiHayCambios(eventosPrevios, eventosNuevos)
    resultado.commitRealizado = commitRealizado

    console.log(JSON.stringify(resultado, null, 2))
    res.status(200).json(resultado)
  } catch (err) {
    console.error('Error en sync-events:', err)
    resultado.errores.push(err.message)
    res.status(500).json(resultado)
  }
}
