import { igualSeguro } from './_auth.js'
import { obtenerSql } from './_db.js'
import { enviarDigest } from './_push-send.js'
import { obtenerNoticiasPrensa } from './_noticias-feed.js'
import { temasDeEvento } from '../src/lib/temasPush.js'

const TYLTYL_API = 'https://www.tyltyl.org/wp-json/tribe/events/v1/events'
const CULTURA_RSS = 'https://www.navalcarnero.es/navalcarnero/cultura/feed/'
const USER_AGENT = 'NavalcarneroApp/0.1 (proyecto vecinal)'

// Leer eventos actuales desde GitHub API (evita EROFS en Vercel runtime)
async function leerEventosDesdeGitHub() {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    return []
  }

  try {
    const [owner, repo] = process.env.GITHUB_REPO.split('/')
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/src/data/eventos-externos.json`,
      {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3.raw',
        },
      },
    )
    if (!res.ok) {
      if (res.status === 404) return []
      throw new Error(`GitHub API respondio ${res.status}`)
    }
    return JSON.parse(await res.text())
  } catch (err) {
    console.warn(`No se pudo leer eventos desde GitHub: ${err.message}`)
    return []
  }
}

// Leer un archivo del repo como TEXTO crudo (para comparar sin reserializar,
// p. ej. noticias.json y detectar si realmente cambió). null si no existe.
async function leerTextoDeGitHub(ruta) {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) return null
  try {
    const [owner, repo] = process.env.GITHUB_REPO.split('/')
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${ruta}`,
      {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3.raw',
        },
      },
    )
    if (!res.ok) {
      if (res.status === 404) return null
      throw new Error(`GitHub API respondio ${res.status}`)
    }
    return await res.text()
  } catch (err) {
    console.warn(`No se pudo leer ${ruta} desde GitHub: ${err.message}`)
    return null
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

// Commit de uno o más archivos al repo en un ÚNICO commit (Git Data API).
// `archivos` = [{ path, contenido }] — solo los que han cambiado. Devuelve true
// si commiteó. Fail-soft: cualquier error se loguea y devuelve false, nunca lanza.
async function commitArchivos(archivos, mensaje) {
  if (!archivos.length) return false
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    console.log('⚠️  No se pudo hacer commit: falta GITHUB_TOKEN o GITHUB_REPO')
    return false
  }

  const [owner, repo] = process.env.GITHUB_REPO.split('/')
  const base = `https://api.github.com/repos/${owner}/${repo}`
  const cabeceras = {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  }

  try {
    // Ref y árbol base actuales de main
    const refRes = await fetch(`${base}/git/refs/heads/main`, { headers: cabeceras })
    if (!refRes.ok) throw new Error(`No se pudo obtener ref de main: ${refRes.status}`)
    const mainSha = (await refRes.json()).object.sha

    const commitRes = await fetch(`${base}/git/commits/${mainSha}`, { headers: cabeceras })
    if (!commitRes.ok) throw new Error(`No se pudo obtener commit: ${commitRes.status}`)
    const treeSha = (await commitRes.json()).tree.sha

    // Un blob por archivo cambiado
    const tree = []
    for (const a of archivos) {
      const blobRes = await fetch(`${base}/git/blobs`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify({ content: a.contenido, encoding: 'utf-8' }),
      })
      if (!blobRes.ok) throw new Error(`No se pudo crear blob (${a.path}): ${blobRes.status}`)
      tree.push({ path: a.path, mode: '100644', type: 'blob', sha: (await blobRes.json()).sha })
    }

    const treeRes = await fetch(`${base}/git/trees`, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({ base_tree: treeSha, tree }),
    })
    if (!treeRes.ok) throw new Error(`No se pudo crear árbol: ${treeRes.status}`)
    const nuevoTree = (await treeRes.json()).sha

    const newCommitRes = await fetch(`${base}/git/commits`, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({ message: mensaje, tree: nuevoTree, parents: [mainSha] }),
    })
    if (!newCommitRes.ok) throw new Error(`No se pudo crear commit: ${newCommitRes.status}`)
    const nuevoCommit = (await newCommitRes.json()).sha

    const updateRefRes = await fetch(`${base}/git/refs/heads/main`, {
      method: 'PATCH',
      headers: cabeceras,
      body: JSON.stringify({ sha: nuevoCommit, force: false }),
    })
    if (!updateRefRes.ok) throw new Error(`No se pudo actualizar ref: ${updateRefRes.status}`)

    console.log(`✓ Commit a GitHub: ${archivos.map((a) => a.path).join(', ')}`)
    return true
  } catch (err) {
    console.error('❌ Error al hacer commit:', err.message)
    return false
  }
}

// Eventos de organizaciones (Neon) que entran en el digest push. Decisión
// (NOTIFICACIONES_PUSH.md daba dos opciones): se incluyen en ESTE digest, no
// se dispara nada al publicar desde api/admin/eventos.js — así el envío queda
// agrupado, en un solo punto y solo en runtime Node. El estado "ya avisado" es
// la columna eventos_usuario.notificado_en: se avisan los publicados futuros
// con notificado_en NULL y el cron la rellena tras el envío, con lo que un
// borrador publicado tarde también entra y las ediciones no re-notifican.
async function eventosNeonPendientes() {
  const sql = obtenerSql()
  const filas = await sql`
    SELECT e.id, e.titulo, e.lugar, e.categoria, e.imagen_url,
           to_char(e.fecha_inicio, 'YYYY-MM-DD') AS fecha,
           o.slug AS organizacion_slug
    FROM eventos_usuario e
    JOIN organizaciones o ON o.id = e.organizacion_id
    WHERE e.estado = 'publicado' AND o.activa = true
      AND e.notificado_en IS NULL AND e.fecha_inicio >= CURRENT_DATE
  `
  return filas.map((e) => ({
    // Mismo id público 'bd-…' que /api/eventos: la URL de la notificación
    // debe abrir la página de detalle real.
    id: `bd-${e.id}`,
    idBd: e.id,
    titulo: e.titulo,
    fecha: e.fecha,
    lugar: e.lugar,
    categoria: e.categoria,
    imagen: e.imagen_url || '',
    organizacionSlug: e.organizacion_slug,
  }))
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Usa GET o POST.' })
    return
  }

  // Vercel Cron autentica con `Authorization: Bearer <CRON_SECRET>`.
  // Comparación en tiempo constante y "fallar cerrado": sin CRON_SECRET
  // configurado nadie puede invocar el endpoint (antes, con la env sin
  // definir, la comparación `undefined !== undefined` dejaba pasar a cualquiera).
  const cabeceraAuth = req.headers['authorization'] || ''
  const secretoValido =
    Boolean(process.env.CRON_SECRET) &&
    (await igualSeguro(cabeceraAuth, `Bearer ${process.env.CRON_SECRET}`))
  if (!secretoValido) {
    res.status(401).json({ error: 'No autorizado' })
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
    // Paso 1: Descargar nuevos eventos de ambas fuentes externas
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

    // Paso 2: Combinar sin duplicados
    const eventosNuevos = combinarSinDuplicados(tyltyl, cultura)
    eventosNuevos.sort(
      (a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''),
    )

    // Paso 3: Leer eventos actuales desde GitHub (comparar con lo recién fetcheado)
    const eventosPrevios = await leerEventosDesdeGitHub()

    // Paso 4: Calcular cambios
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

    // Preparar los archivos que cambian (eventos + noticias de prensa) para un
    // ÚNICO commit a GitHub (NO se escribe en disco: EROFS en el runtime).
    const archivos = []

    const eventosNuevoJson = JSON.stringify(eventosNuevos, null, 2)
    if (eventosNuevoJson !== JSON.stringify(eventosPrevios, null, 2)) {
      archivos.push({ path: 'src/data/eventos-externos.json', contenido: eventosNuevoJson })
    } else {
      console.log('✓ Sin cambios en eventos-externos.json')
    }

    // Noticias de prensa (RSS del Ayuntamiento). Fail-soft en su propio try:
    // un fallo aquí se anota en `errores` pero jamás tumba la sync de eventos
    // ni el digest push. Se compara contra el texto crudo del repo para no
    // commitear si no cambió (mismo formato que escribe fetch-noticias.mjs).
    try {
      const noticias = await obtenerNoticiasPrensa()
      resultado.estadisticas = { ...resultado.estadisticas, noticias: noticias.length }
      const noticiasNuevoJson = JSON.stringify(noticias, null, 2) + '\n'
      if (noticias.length > 0 && (await leerTextoDeGitHub('src/data/noticias.json')) !== noticiasNuevoJson) {
        archivos.push({ path: 'src/data/noticias.json', contenido: noticiasNuevoJson })
      } else {
        console.log('✓ Sin cambios en noticias.json')
      }
    } catch (err) {
      resultado.errores.push(`Noticias prensa: ${err.message}`)
    }

    const commitRealizado = await commitArchivos(
      archivos,
      `chore: sync events + noticias from external sources at ${new Date().toISOString()}`,
    )
    resultado.commitRealizado = commitRealizado

    // Paso 5: digest push. Cualquier fallo aquí se loguea y se anota en
    // `errores`, pero jamás tumba la sincronización (el commit ya está hecho).
    try {
      const hoyISO = new Date().toISOString().slice(0, 10)
      const agregadosExternos = eventosNuevos.filter(
        (e) => !idsAnteriores.has(e.id) && e.fecha >= hoyISO,
      )

      let deNeon = []
      try {
        deNeon = await eventosNeonPendientes()
      } catch (err) {
        resultado.errores.push(`Push (Neon): ${err.message}`)
      }

      // Etiquetar cada evento con sus temas ('cat:…' + 'org:…') antes de
      // comparar contra las suscripciones. El mapeo fuente→slug vive en
      // src/lib/temasPush.js: un evento del TYL TYL matchea org:tyl-tyl tanto
      // si viene de su API de WordPress como de su panel de Neon.
      const paraAvisar = [...agregadosExternos, ...deNeon].map((e) => ({
        ...e,
        temas: temasDeEvento(e),
      }))

      // Registrar cada evento anunciado en el historial (la "bandeja" que el
      // vecino ve en la app). Se hace ANTES del envío y en su propio try: la
      // bandeja debe poblarse aunque las claves VAPID no estén configuradas o
      // el envío falle. UNIQUE(referencia_id) + ON CONFLICT evita duplicar un
      // evento si reaparece en otra ejecución del cron.
      if (paraAvisar.length > 0) {
        try {
          const sql = obtenerSql()
          for (const e of paraAvisar) {
            const cuerpo = [e.fecha, e.lugar].filter(Boolean).join(' · ')
            await sql`
              INSERT INTO push_avisos (referencia_id, titulo, cuerpo, url, temas)
              VALUES (${e.id}, ${e.titulo}, ${cuerpo}, ${`/eventos/${e.id}`},
                      ${JSON.stringify(e.temas)}::jsonb)
              ON CONFLICT (referencia_id) DO NOTHING
            `
          }
        } catch (err) {
          resultado.errores.push(`Push (bandeja): ${err.message}`)
        }
      }

      const resumenPush = await enviarDigest(paraAvisar)
      resultado.push = resumenPush

      if (resumenPush.configurado && deNeon.length > 0) {
        const sql = obtenerSql()
        await sql`
          UPDATE eventos_usuario SET notificado_en = now()
          WHERE id = ANY(${deNeon.map((e) => e.idBd)})
        `
      }
    } catch (err) {
      console.error('Push: fallo en el digest:', err)
      resultado.errores.push(`Push: ${err.message}`)
    }

    console.log(JSON.stringify(resultado, null, 2))
    res.status(200).json(resultado)
  } catch (err) {
    console.error('Error en sync-events:', err)
    resultado.errores.push(err.message)
    res.status(500).json(resultado)
  }
}
