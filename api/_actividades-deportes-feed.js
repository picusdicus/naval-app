// Descarga y parseo del RSS de DEPORTES del Ayuntamiento
// (https://navalcarnero.es/navalcarnero/deportes/feed/) para extraer actividades
// de fiestas patronales y otros programas deportivos.
//
// La entrada "ACTIVIDADES DEPORTIVAS..." contiene una galería de carteles (imágenes
// con título, número de orden y fecha) en el content:encoded. Cada cartel representa
// una actividad real, salvo los que tienen "fin de plazo" / "fin plazo" (recordatorios
// de cierre, que aparean junto a la actividad real en la galería).
//
// Lo usa api/sync-events.js (el cron diario, que incorpora las actividades completas
// del feed de deportes a la BD).

const DEPORTES_RSS = 'https://navalcarnero.es/navalcarnero/deportes/feed/'
const USER_AGENT = 'NavalcarneroApp/0.1 (proyecto vecinal)'

async function descargarTexto(url, señal) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: señal })
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

function limpiarTexto(html) {
  if (!html) return ''
  return decodificarEntidades(String(html).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function quitarCDATA(txt) {
  return txt.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '')
}

function campoRSS(itemXml, tag) {
  const m = itemXml.match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`))
  return m ? quitarCDATA(m[0].replace(/^[^>]*>/, '').replace(/<\/[^>]*>$/, '')).trim() : ''
}

function tituloLegible(txt) {
  const base = decodificarEntidades(txt).replace(/\s+/g, ' ').trim()
  const letras = (base.match(/\p{L}/gu) || []).length
  const mays = (base.match(/\p{Lu}/gu) || []).length
  const casiTodoMayus = letras > 0 && mays / letras > 0.7
  if (!casiTodoMayus) return base

  // MAYÚSCULAS → Capitalizar solo primera letra
  const [primera, ...resto] = base.split('')
  return primera.toUpperCase() + resto.join('').toLowerCase()
}

// Extrae fecha del nombre del fichero y del title HTML.
// El título puede tener: "5. ACTIVIDAD 25 Agosto" o "9. ACTIVIDAD del 27 de agosto al 5 de sept"
// El año viene del pubDate del item.
function extraerFecha(titulo, pubDateStr) {
  const pubDate = new Date(pubDateStr)
  const año = pubDate.getFullYear()

  // Buscar patrón: "NN de Mes", "NN Mes", o "del NN de Mes"
  const meses = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, setiembre: 9, sept: 9,
    octubre: 10, noviembre: 11, diciembre: 12
  }

  const regex = /(?:del\s+)?(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)/gi
  let match

  while ((match = regex.exec(titulo)) !== null) {
    const día = parseInt(match[1])
    const mesStr = match[2].toLowerCase()
    const mes = meses[mesStr]

    if (mes && día >= 1 && día <= 31) {
      // Retorna solo la primera fecha encontrada (inicio del rango)
      return `${año}-${String(mes).padStart(2, '0')}-${String(día).padStart(2, '0')}`
    }
  }

  return null
}

// Normaliza el nombre del fichero para usar como origen_externo_id.
// Soporta múltiples formatos:
// "22.-NATACIÓN-30-Agosto-150x150.jpg" → "deportes-22-natacion-30-agosto"
// "natacion-30-agosto-150x150.jpg" → "deportes-natacion-30-agosto"
// "WATERPOLO.jpg" → "deportes-waterpolo"
function origenIdDelFichero(src) {
  // Intenta match 1: número + punto-guión (formato original)
  let match = src.match(/\/(\d+)\.-([^/]+?)-(?:\d+x\d+)?\.jpg$/i)
  if (match) {
    const [, numero, nombre] = match
    const slug = nombre
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[áéíóú]/g, c => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c]))
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    return `deportes-${numero}-${slug}`
  }

  // Fallback: extrae el nombre del fichero sin extensión
  match = src.match(/\/([^/]+?)(?:-\d+x\d+)?\.jpg$/i)
  if (match) {
    const nombre = match[1]
    const slug = nombre
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[áéíóú]/g, c => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c]))
      .replace(/[_]/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    return slug ? `deportes-${slug}` : null
  }

  return null
}

// Palabras que NATURALMENTE terminan en "s" y NO son plurales
// (nunca se deben transformar a singular)
const EXCEPCIONES_PLURALES = new Set([
  'tenis',      // "Tenis de mesa" no es plural de "teni"
  'mus',        // Juego de naipes
  'las',        // Artículo definido (debería filtrarse antes, pero por si acaso)
  'los',        // Artículo definido
  'cms',        // Abreviatura (centímetros)
  'fitness',    // Palabra inglesa, no plural
  'pilates'     // Marca/disciplina, no plural
])

// Diccionario cerrado de sinónimos deportivos
const SINONIMOS_DEPORTES = {
  basket: 'baloncesto',
  baloncesto: 'baloncesto',
  acua: 'aqua',
  aqua: 'aqua'
}

// Normaliza una palabra aplicando sinónimos si existen
function normalizarPalabra(palabra) {
  const p = palabra.toLowerCase().replace(/[.,;:]/g, '') // Eliminar puntuación final

  // Si termina en "s" (plural simple), devolver la forma singular
  // "pruebas" → "prueba", "competiciones" → "competicion"
  // EXCEPTO palabras que naturalmente terminan en "s"
  let base = p
  if (p.endsWith('s') && p.length > 3 && !EXCEPCIONES_PLURALES.has(p)) {
    base = p.slice(0, -1) // Singular sin la "s"
  }

  // Aplicar sinónimos
  return SINONIMOS_DEPORTES[base] || SINONIMOS_DEPORTES[p] || base
}

// Normaliza título para matching: lowercase, sin acentos, solo palabras significativas
function normalizarParaMatching(txt) {
  return new Set(
    String(txt || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .split(/\s+/)
      .filter(p => p.length > 2) // Solo palabras ≥3 caracteres (excluye "de", "el", "un", etc.)
      .map(normalizarPalabra) // Aplicar sinónimos y normalización de plurales
  )
}

// Cuenta coincidencias de palabras clave entre dos títulos
function contarPalabrasCoincidentes(titulo1, titulo2) {
  const palabras1 = normalizarParaMatching(titulo1)
  const palabras2 = normalizarParaMatching(titulo2)
  return [...palabras2].filter(p => palabras1.has(p)).length
}

// Genera la clave normalizada de un título (idéntico a sync-events.js claveNorm)
function claveNormPrograma(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Busca un cartel en el programa por fecha exacta + ≥2 palabras clave coincidentes
function encontrarEventoEnPrograma(cartel, programa) {
  if (!cartel.fecha_evento || !programa || programa.length === 0) {
    return null
  }

  // Filtrar programa por fecha exacta
  const eventosMismaFecha = programa.filter(e => e.fecha === cartel.fecha_evento)
  if (eventosMismaFecha.length === 0) return null

  // Entre los de la misma fecha, buscar por keywords (mínimo 2 palabras coincidentes)
  for (const evento of eventosMismaFecha) {
    const coincidencias = contarPalabrasCoincidentes(evento.titulo, cartel.titulo)
    if (coincidencias >= 2) {
      return evento
    }
  }

  return null
}

/**
 * Extrae actividades deportivas del RSS de Deportes.
 * Busca la entrada con "ACTIVIDADES DEPORTIVAS FIESTAS PATRONALES" y parsea
 * todos los carteles de la galería en content:encoded.
 *
 * Devuelve array de actividades + estadísticas:
 * {
 *   actividades: [{ titulo, fecha_evento, imagen, url_fuente, origen_externo_id }, ...],
 *   detectadasFinPlazo: 7,      // cantidad de "fin de plazo" detectados
 *   emparejamientos: 0,          // cuántos se emparejaron con su actividad
 * }
 */
export async function obtenerActividadesDeportivas(programaFiestas = []) {
  const rss = await descargarTexto(DEPORTES_RSS, AbortSignal.timeout(15000))

  // Buscar el item con "ACTIVIDADES DEPORTIVAS FIESTAS PATRONALES"
  const itemMatch = rss.match(
    /<item>[\s\S]*?<title>[^<]*ACTIVIDADES\s+DEPORTIVAS[\s\S]*?<\/item>/i
  )
  if (!itemMatch) {
    return { actividades: [], detectadasFinPlazo: 0, emparejamientos: 0 }
  }

  const itemXml = itemMatch[0]

  // Extraer pubDate y link
  const pubDateMatch = itemXml.match(/<pubDate>([^<]+)<\/pubDate>/)
  const pubDate = pubDateMatch ? pubDateMatch[1] : ''

  const linkMatch = itemXml.match(/<link>([^<]+)<\/link>/)
  if (!linkMatch) {
    return { actividades: [], detectadasFinPlazo: 0, emparejamientos: 0 }
  }
  const urlPagina = linkMatch[1]

  // Descargar la página (la galería está en el HTML, no en el RSS)
  const html = await descargarTexto(urlPagina, AbortSignal.timeout(15000))
  if (!html) {
    return { actividades: [], detectadasFinPlazo: 0, emparejamientos: 0 }
  }

  // Extraer contenido principal
  let contenido = html
  const matchEntrada = html.match(/<div[^>]*class="[^"]*entrada[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)
  if (matchEntrada && matchEntrada[1].length > 1000) {
    contenido = matchEntrada[1]
  }

  const MAX_HTML_BYTES = 300_000
  if (contenido.length > MAX_HTML_BYTES) {
    contenido = contenido.substring(0, MAX_HTML_BYTES)
  }

  const contentEncoded = contenido

  // Extraer galería WordPress: <a href='...' title='...'><img data-lazy-src='...' alt='...' /></a>
  // Estrategia simple: buscar secuencia <a href='X' title='Y'><img ... data-lazy-src='Z' ... alt='W'
  // sin asumir nada entre los tags (ya que pueden haber atributos en cualquier orden)
  const carteles = []

  // Regex que busca el patrón completo sin cuidar el orden de atributos
  const regexCartel = /<a\s+[^>]*href='([^']*)'[^>]*title='([^']*)'[^>]*><img[^>]*>/gi
  let m
  while ((m = regexCartel.exec(contentEncoded))) {
    const [fullMatch, href, title] = m

    // Del fullMatch, extraer el <img...> y sus atributos
    const imgMatch = fullMatch.match(/<img[^>]*>/)
    if (!imgMatch) continue

    const imgTag = imgMatch[0]

    // Extraer data-lazy-src (la imagen real)
    const lazyMatch = imgTag.match(/data-lazy-src="([^"]*)"/)
    const imgSrc = lazyMatch ? lazyMatch[1] : ''

    // Extraer alt
    const altMatch = imgTag.match(/alt="([^"]*)"/)
    const alt = altMatch ? altMatch[1] : ''

    // Validar que tenemos los datos esenciales
    if (imgSrc && alt) {
      carteles.push([fullMatch, href, title, imgSrc, alt])
    }
  }

  const actividades = []
  const finDePlazo = []
  let descartadosSinTitulo = 0
  let descartadosSinOrigen = 0
  let enriquecidosDelPrograma = 0

  for (const [, href, title, src, alt] of carteles) {
    const esFinDePlazo = /fin\s*de\s*plazo|fin\s*plazo/i.test(title)

    if (esFinDePlazo) {
      finDePlazo.push({ title, src })
      continue
    }

    // Quitar número de orden del título: "22. NATACIÓN 30 Agosto" → "NATACIÓN 30 Agosto"
    const tituloLimpio = title.replace(/^\d+\.\s*/, '').trim()
    const titulo = tituloLegible(tituloLimpio)
    const fechaEvento = extraerFecha(title, pubDate)
    const origen = origenIdDelFichero(src)

    // URL a imagen tamaño completo (quitar -150x150 del src)
    const imagenCompleta = src.replace(/-150x150\.jpg$/, '.jpg')

    // Permitir carteles sin fecha explícita (usaremos null y el frontend decidirá)
    // pero descartar sin título u origen
    if (titulo && origen) {
      // Buscar coincidencia en programa de fiestas: fecha + ≥2 palabras clave
      const cartelParaMatching = {
        titulo,
        fecha_evento: fechaEvento,
        imagen: imagenCompleta
      }
      const eventoEnPrograma = encontrarEventoEnPrograma(cartelParaMatching, programaFiestas)

      if (eventoEnPrograma) {
        // El cartel matchea con un evento del programa
        // Marcar que esta imagen enriquece el evento existente (no crear nuevo)
        enriquecidosDelPrograma++
        // Generar el ID del evento del programa (fiestas-<clave>-<fecha>)
        // para que sync-events.js sepa cuál evento enriquecer
        const claveEvento = claveNormPrograma(eventoEnPrograma.titulo)
        const idEventoPrograma = `fiestas-${claveEvento}-${eventoEnPrograma.fecha}`
        // La imagen se propaga al cron para adjuntarla al evento del programa
        // (implementado en sync-events.js al procesar este resultado)
        actividades.push({
          titulo,
          fecha_evento: fechaEvento,
          imagen: imagenCompleta,
          url_fuente: 'https://navalcarnero.es/navalcarnero/prensa/programacion-deportiva-fiestas-patronales-2026/',
          origen_externo_id: origen,
          categoria: 'deporte',
          enriqueceEvento: idEventoPrograma // Marca: esto enriquece el evento existente
        })
      } else {
        // El cartel no matchea: crear como evento nuevo
        actividades.push({
          titulo,
          fecha_evento: fechaEvento,
          imagen: imagenCompleta,
          url_fuente: 'https://navalcarnero.es/navalcarnero/prensa/programacion-deportiva-fiestas-patronales-2026/',
          origen_externo_id: origen,
          categoria: 'deporte'
        })
      }
    } else {
      if (!titulo) descartadosSinTitulo++
      if (!origen) descartadosSinOrigen++
      // Log silencioso: no queremos romper el flujo, pero es útil para auditoría
      console.log(`[deportes] Descartado - titulo: "${titulo}" origen: "${origen}" url: ${src}`)
    }
  }

  // Procesar "fin de plazo" huérfanos: si no existe su actividad gemela, crear una desde el plazo
  // Marca: prefijo deportes-plazo- para distinguirlas de las extraídas de carteles de actividad
  // fecha_evento: NULL (no sabemos cuándo se celebra, solo cuándo cierran inscripciones)
  // fecha_limite: extraída del título del cartel de plazo
  const actividadesTotales = new Set(actividades.map(a => a.titulo.toUpperCase()))

  for (const plazo of finDePlazo) {
    // Limpiar título: "29. fin plazo AQUATLÓN 2 Sept" → "AQUATLÓN"
    const tituloLimpio = plazo.title
      .replace(/^\d+\.\s*/, '') // quitar número de orden
      .replace(/fin\s*(?:de\s*)?plazo\s*/i, '') // quitar "fin plazo" o "fin de plazo"
      .replace(/\s+\d+\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre).*/i, '') // quitar fecha
      .trim()
    const titulo = tituloLegible(tituloLimpio)

    // Extraer fecha del cartel (es la del plazo, no la de celebración)
    const fechaLimite = extraerFecha(plazo.title, pubDate)

    // Buscar si existe actividad gemela: búsqueda estricta por palabras clave
    // Normalizar títulos para comparación
    const normalizarTitulo = (t) => t.toUpperCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
    const tituloNorm = normalizarTitulo(titulo)

    const tieneGemela = [...actividadesTotales].some(a => {
      const aNorm = normalizarTitulo(a)
      // Igualdad exacta o una contiene la otra (para "Tenis de mesa" vs "TENIS DE MESA", etc.)
      return aNorm === tituloNorm || aNorm.includes(tituloNorm) || tituloNorm.includes(aNorm)
    })

    if (!tieneGemela && titulo) {
      // Crear actividad desde el plazo (huérfana)
      // fecha_evento: NULL (honestidad: no sabemos cuándo se celebra)
      // fecha_limite: la del cartel de plazo
      // origen_externo_id: deportes-plazo-<slug> para marcar que es reconstruida
      const origen = `deportes-plazo-${titulo.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-')}`

      // URL a imagen tamaño completo (quitar -150x150 del src si existe)
      const imagenCompleta = plazo.src.replace(/-150x150\.jpg$/, '.jpg')

      actividades.push({
        titulo,
        fecha_evento: null, // No sabemos cuándo se celebra
        fecha_limite: fechaLimite, // Sí sabemos cuándo cierran inscripciones
        imagen: imagenCompleta,
        url_fuente: 'https://navalcarnero.es/navalcarnero/prensa/programacion-deportiva-fiestas-patronales-2026/',
        origen_externo_id: origen,
        categoria: 'deporte',
        reconstruido_desde_plazo: true // Marca para auditoría/debugging
      })

      actividadesTotales.add(titulo.toUpperCase())
    }
  }

  return {
    actividades,
    detectadasFinPlazo: finDePlazo.length,
    emparejamientos: actividades.filter(a => a.reconstruido_desde_plazo).length,
    extraidos: carteles.length,
    descartadosSinTitulo,
    descartadosSinOrigen,
    enriquecidosDelPrograma
  }
}
