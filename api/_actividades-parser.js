// Extracción de programaciones enlazadas desde posts de Instagram:
// - HTML: buscar imágenes de galería + sus alt texts (los títulos de las
//   actividades suelen vivir ahí), luego estandarizar con Claude.
// - PDF (agendas municipales): el documento entero viaja a Claude, que
//   devuelve DOS listas — eventos de agenda (a los que se asiste) y
//   actividades (a las que uno se apunta o en las que participa).
// Todo lo extraído de un documento nace `borrador` en quien lo inserta
// (sync-instagram-noticias.js): un error de extracción aquí no son uno sino
// decenas de items, así que pasan por validación humana en /admin.

import Anthropic from '@anthropic-ai/sdk'
import { JSDOM } from 'jsdom'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

// Misma taxonomía de eventos que api/sync-instagram.js / la agenda.
const CATEGORIAS_EVENTO = ['cultura', 'deporte', 'fiestas', 'gastronomia', 'infantil', 'mercado']

// Misma whitelist que el CHECK de la tabla actividades y que
// CATEGORIAS_ACTIVIDAD en api/sync-instagram-noticias.js.
const CATEGORIAS_ACTIVIDAD = [
  'deporte',
  'talleres',
  'infantil',
  'mayores',
  'educacion',
  'ayudas',
  'empleo',
  'general',
]

// Mismo patrón que los webhooks: el json_schema fuerza la forma y los valores
// se re-validan aparte. '' es el sentinel de "no aplica" (sin nullables).
const ESQUEMA_ACTIVIDADES = {
  type: 'object',
  additionalProperties: false,
  required: ['actividades'],
  properties: {
    actividades: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'categoria', 'fechaLimite', 'horario', 'lugar'],
        properties: {
          // '' = candidato descartado (no es una actividad real).
          titulo: { type: 'string' },
          categoria: { enum: [...CATEGORIAS_ACTIVIDAD, ''] },
          fechaLimite: { type: 'string' },
          horario: { type: 'string' },
          lugar: { type: 'string' },
        },
      },
    },
  },
}

/**
 * Parsea el HTML buscando imágenes de galerías con títulos útiles.
 * Estrategia: muchas páginas municipales usan galerías WordPress donde
 * cada imagen tiene un título informativo en alt text.
 * Retorna candidatos con: titulo, imagenUrl.
 */
function parseHtmlInteligente(html) {
  try {
    const dom = new JSDOM(html)
    const doc = dom.window.document

    const actividades = []

    // Estrategia 1: Buscar elementos de galería (WordPress gallery)
    // Nota: WordPress usa lazy loading, así que data-lazy-src tiene la URL real
    const galeriaItems = doc.querySelectorAll('.gallery-item img')
    if (galeriaItems.length > 0) {
      console.log(`[parseHtmlInteligente] Galería encontrada: ${galeriaItems.length} imágenes`)
      for (const img of galeriaItems) {
        const alt = img.alt?.trim() || img.title?.trim()
        // Prioridad: data-lazy-src (lazy loading) > src > title attribute
        const url = img.getAttribute('data-lazy-src') || img.src || img.getAttribute('data-src')
        if (alt && alt.length > 5 && url && !url.includes('1x1.trans.gif')) {
          actividades.push({
            titulo: alt,
            imagenUrl: url, // URL real de la imagen en el HTML
          })
        }
      }
    }

    // Estrategia 2: Fallback a cualquier imagen con alt text descriptivo
    if (actividades.length === 0) {
      console.log(`[parseHtmlInteligente] Sin galería, buscando imágenes con alt text`)
      const imgs = doc.querySelectorAll('img[alt]')
      for (const img of imgs) {
        const alt = img.alt.trim()
        const url = img.src || img.getAttribute('data-lazy-src')
        // Filtrar: descartar logos, iconos de redes, etc
        const esRelevante =
          alt.length > 10 &&
          !alt.match(/logo|facebook|twitter|linkedin|compartir|share|instagram/i) &&
          url &&
          !url.includes('/icons/') &&
          !url.includes('/theme/')
        if (esRelevante) {
          actividades.push({
            titulo: alt,
            imagenUrl: url,
          })
        }
      }
    }

    console.log(`[parseHtmlInteligente] Total candidatos: ${actividades.length}`)
    return actividades.slice(0, 50) // Limitar a 50 para no saturar Claude
  } catch (err) {
    console.error('[parseHtmlInteligente] Error:', err.message)
    return []
  }
}

/**
 * Usa Claude para validar, estandarizar y enriquecer actividades.
 * Retorna array de actividades con: titulo, categoria, fechaLimite, horario, lugar, imagenUrl.
 */
async function validarConClaude(candidatos) {
  if (candidatos.length === 0) return []

  const client = new Anthropic()
  const hoy = new Date().toISOString().slice(0, 10)

  const instrucciones = `Analiza títulos extraídos de una página municipal de Navalcarnero (alt text de imágenes de una galería) y decide cuáles describen una ACTIVIDAD para el vecino: algo a lo que puede APUNTARSE o en lo que puede PARTICIPAR — cursos, talleres, escuelas deportivas, campamentos, ayudas, becas, y también pruebas deportivas participativas (torneos, carreras, marchas, memoriales, exhibiciones abiertas), aunque la inscripción sea el mismo día de la prueba.

NO son actividades (devuélvelas con titulo=""): elementos de navegación o decoración de la web, logos, y títulos que no describan ninguna actividad concreta.

Para cada candidato devuelve, en el mismo orden en que se recibe:
- titulo: limpio y legible (sin números de orden como "39. ", sin mayúsculas gritadas), o "" para descartarlo.
- categoria: la más apropiada de la lista permitida ("deporte" para las pruebas deportivas); "" si el título se descarta.
- fechaLimite: YYYY-MM-DD del plazo de inscripción o, en pruebas de un día, la fecha de la prueba (último día para apuntarse). Hoy es ${hoy}: resuelve fechas relativas con ese ancla. "" si no hay fecha.
- horario: el horario si el título lo indica (p. ej. "10:00h"); "" si no.
- lugar: la instalación o ubicación si el título la indica; "" si no.`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: instrucciones,
      output_config: { format: { type: 'json_schema', schema: ESQUEMA_ACTIVIDADES } },
      messages: [
        {
          role: 'user',
          content: JSON.stringify(candidatos.map((c) => ({ titulo: c.titulo }))),
        },
      ],
    })
    if (response.stop_reason === 'refusal') {
      console.warn('[validarConClaude] El modelo rechazó la petición')
      return []
    }
    if (response.stop_reason === 'max_tokens') {
      console.warn('[validarConClaude] Respuesta truncada por max_tokens')
      return []
    }

    const texto = response.content.find((b) => b.type === 'text')?.text || '{"actividades":[]}'
    const crudas = JSON.parse(texto).actividades || []
    // Re-validación de valores (nunca se confía en la salida del modelo).
    return crudas
      .filter((a) => typeof a.titulo === 'string' && a.titulo.trim())
      .map((a) => ({
        titulo: a.titulo.trim().slice(0, 200),
        categoria: CATEGORIAS_ACTIVIDAD.includes(a.categoria) ? a.categoria : 'general',
        fechaLimite: /^\d{4}-\d{2}-\d{2}$/.test(a.fechaLimite) ? a.fechaLimite : null,
        horario: String(a.horario || '').trim().slice(0, 120) || null,
        lugar: String(a.lugar || '').trim().slice(0, 120) || null,
      }))
  } catch (err) {
    console.error('[validarConClaude] Error:', err.message)
    return []
  }
}

/**
 * Orquesta el parsing, validación y enriquecimiento de actividades.
 * `imagenFallback` debe ser una URL durable (el blob ya subido de la foto del
 * post, no la URL cruda del CDN de Instagram, que caduca en días).
 */
export async function extraerActividadesDeHTML(html, urlFuente, imagenFallback, shortCode) {
  // Paso 1: parsing inteligente
  const candidatos = parseHtmlInteligente(html)
  if (candidatos.length === 0) {
    console.log('[extraerActividadesDeHTML] No candidatos encontrados en HTML')
    return []
  }

  console.log(`[extraerActividadesDeHTML] ${candidatos.length} candidatos de ${shortCode}`)

  // Paso 2: validar + enriquecer con Claude
  const validadas = await validarConClaude(candidatos)
  if (validadas.length === 0) {
    console.log('[extraerActividadesDeHTML] Claude no validó ninguna actividad')
    return []
  }

  console.log(`[extraerActividadesDeHTML] Claude validó ${validadas.length}/${candidatos.length}`)

  // Paso 3: procesar imágenes
  // Mapear validadas con candidatos originales para obtener URLs de las imágenes del HTML
  // Matching flexible: ignorar números de orden y usar palabras clave principales
  const extraerPalabras = (t) => t.replace(/^\d+\.\s+/, '').toLowerCase().split(/\s+/).filter(p => p.length > 3)

  for (let idx = 0; idx < validadas.length; idx++) {
    const act = validadas[idx]
    // Buscar candidato con máximo overlap de palabras
    let candidato = null
    let maxOverlap = 0
    const palabrasAct = extraerPalabras(act.titulo)

    for (const c of candidatos) {
      const palabrasC = extraerPalabras(c.titulo)
      const overlap = palabrasAct.filter(p => palabrasC.some(pc => pc.includes(p) || p.includes(pc))).length
      if (overlap > maxOverlap) {
        maxOverlap = overlap
        candidato = c
      }
    }

    const imagenUrlCandidato = candidato?.imagenUrl

    if (imagenUrlCandidato) {
      // Derivar versión full-size si es miniatura de WordPress (-150x150.jpg → .jpg)
      let urlFinal = imagenUrlCandidato
      if (imagenUrlCandidato.includes('-150x150')) {
        urlFinal = imagenUrlCandidato.replace(/-150x150\./, '.')
        console.log(`[parser] Full-size derivada: ${urlFinal}`)
      }

      // Usar directamente la URL municipal (durables + evita colisiones en Blob)
      // Las URLs municipales son de confianza y no expiran
      act.imagen_url = urlFinal
    } else {
      // Sin imagen en el HTML: el blob de la foto del post (o null).
      act.imagen_url = imagenFallback || null
    }
  }

  return validadas
}

// ——— PDF (agendas y programaciones municipales) ———

// Mismo patrón que el resto de extracciones: forma por json_schema, valores
// re-validados aparte. '' = "no aplica".
const ESQUEMA_DOCUMENTO = {
  type: 'object',
  additionalProperties: false,
  required: ['eventos', 'actividades'],
  properties: {
    eventos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'fecha', 'hora', 'lugar', 'categoria', 'descripcion'],
        properties: {
          titulo: { type: 'string' },
          fecha: { type: 'string' },
          hora: { type: 'string' },
          lugar: { type: 'string' },
          categoria: { enum: CATEGORIAS_EVENTO },
          descripcion: { type: 'string' },
        },
      },
    },
    actividades: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'categoria', 'fechaLimite', 'horario', 'lugar'],
        properties: {
          titulo: { type: 'string' },
          categoria: { enum: CATEGORIAS_ACTIVIDAD },
          fechaLimite: { type: 'string' },
          horario: { type: 'string' },
          lugar: { type: 'string' },
        },
      },
    },
  },
}

/**
 * Extrae la programación completa de un PDF municipal (agenda cultural,
 * programación deportiva…): eventos de agenda Y actividades participativas.
 * Devuelve `{eventos: [], actividades: []}` ya re-validados; ante cualquier
 * fallo devuelve listas vacías (el post sigue su curso sin programación).
 */
async function extraerDePdf(buffer, shortCode) {
  const client = new Anthropic()
  const hoy = new Date().toISOString().slice(0, 10)

  const instrucciones = `El documento es una programación o agenda municipal de Navalcarnero (Madrid). Extrae de él dos listas:

1. "eventos": actos de agenda a los que un vecino ASISTE en un momento concreto como público (una función, un concierto, una proyección, una fiesta, un mercado). Cada uno necesita fecha concreta (YYYY-MM-DD; si dura varios días, el día de inicio), hora (HH:MM en 24 h), lugar (el nombre del sitio, sin ", Navalcarnero"), la categoria más apropiada de la lista permitida, y una descripcion breve (máximo 300 caracteres). Descarta los actos sin fecha u hora concretas y los anteriores a hoy (${hoy}).

2. "actividades": cosas a las que el vecino se APUNTA o en las que PARTICIPA — cursos, talleres, escuelas, campamentos, y pruebas deportivas participativas (torneos, carreras, marchas), aunque la inscripción sea el día de la prueba. fechaLimite = fin del plazo de inscripción (o la fecha de la prueba si es de un día), "" si no consta; horario y lugar si constan, "" si no.

Un mismo elemento va en UNA de las dos listas, no en ambas. Si el año no aparece explícito, dedúcelo del contexto del documento (hoy es ${hoy}). Títulos cortos y legibles, sin mayúsculas gritadas.

IMPORTANTE: extrae ÚNICAMENTE elementos que aparezcan en el documento, con sus fechas y datos literales — no inventes, completes ni deduzcas actos, fechas u horas que no estén escritos. Ante la duda sobre un dato, omite el elemento entero. Omite también las actividades cuya celebración o plazo ya hayan pasado respecto a hoy.`

  try {
    const respuesta = await client.messages.create({
      model: MODEL,
      max_tokens: 16384,
      system: instrucciones,
      output_config: { format: { type: 'json_schema', schema: ESQUEMA_DOCUMENTO } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: buffer.toString('base64'),
              },
            },
            { type: 'text', text: 'Extrae la programación de este documento.' },
          ],
        },
      ],
    })
    if (respuesta.stop_reason === 'refusal') {
      console.warn(`[extraerDePdf] ${shortCode}: el modelo rechazó la petición`)
      return { eventos: [], actividades: [] }
    }

    const texto =
      respuesta.content.find((b) => b.type === 'text')?.text || '{"eventos":[],"actividades":[]}'
    const crudo = JSON.parse(texto)

    const eventos = (crudo.eventos || [])
      .filter(
        (e) =>
          typeof e.titulo === 'string' &&
          e.titulo.trim() &&
          /^\d{4}-\d{2}-\d{2}$/.test(e.fecha) &&
          e.fecha >= hoy &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(e.hora) &&
          typeof e.lugar === 'string' &&
          e.lugar.trim() &&
          CATEGORIAS_EVENTO.includes(e.categoria)
      )
      .map((e) => ({
        titulo: e.titulo.trim().slice(0, 200),
        fecha: e.fecha,
        hora: e.hora,
        lugar: e.lugar.trim().slice(0, 120),
        categoria: e.categoria,
        descripcion: String(e.descripcion || '').trim().slice(0, 1000),
      }))

    const actividades = (crudo.actividades || [])
      .filter((a) => typeof a.titulo === 'string' && a.titulo.trim())
      .map((a) => ({
        titulo: a.titulo.trim().slice(0, 200),
        categoria: CATEGORIAS_ACTIVIDAD.includes(a.categoria) ? a.categoria : 'general',
        fechaLimite: /^\d{4}-\d{2}-\d{2}$/.test(a.fechaLimite) ? a.fechaLimite : null,
        horario: String(a.horario || '').trim().slice(0, 120) || null,
        lugar: String(a.lugar || '').trim().slice(0, 120) || null,
        imagen_url: null, // un PDF no trae imagen por item; el caller pone el fallback
      }))
      // Un PDF de agenda trimestral arrastra plazos ya vencidos (la de
      // jun-jul-ago se sincroniza en agosto): fuera — solo ensuciarían la
      // bandeja de Pendientes.
      .filter((a) => !a.fechaLimite || a.fechaLimite >= hoy)

    return { eventos, actividades }
  } catch (err) {
    console.error(`[extraerDePdf] ${shortCode}:`, err.message)
    return { eventos: [], actividades: [] }
  }
}

// ——— Carrusel de carteles (una actividad por foto del post) ———

// Los índices vuelven en la respuesta para poder emparejar cada actividad con
// la foto del carrusel de la que salió (la extracción puede descartar
// candidatos, así que el orden no basta).
const ESQUEMA_CARRUSEL = {
  type: 'object',
  additionalProperties: false,
  required: ['actividades'],
  properties: {
    actividades: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['indice', 'titulo', 'categoria', 'fechaLimite', 'horario', 'lugar'],
        properties: {
          indice: { type: 'integer' },
          titulo: { type: 'string' },
          categoria: { enum: [...CATEGORIAS_ACTIVIDAD, ''] },
          fechaLimite: { type: 'string' },
          horario: { type: 'string' },
          lugar: { type: 'string' },
        },
      },
    },
  },
}

/**
 * Extrae una actividad por cartel de un carrusel de Instagram. Cada candidato
 * es {indice, alt}: el alt es el OCR del cartel que genera Instagram, y en los
 * posts municipales de programación lleva todos los datos de la prueba
 * (nombre, fecha, plazo de inscripción, lugar). Devuelve la lista validada,
 * cada item con su `indice` original para emparejar la foto.
 */
export async function extraerDeCarrusel(candidatos, publicado) {
  if (!candidatos.length) return []
  const client = new Anthropic()
  const hoy = new Date().toISOString().slice(0, 10)
  const ancla = /^\d{4}-\d{2}-\d{2}/.test(publicado || '') ? publicado.slice(0, 10) : hoy

  const instrucciones = `Cada candidato es el texto OCR ("alt") del cartel de una foto de un post municipal de Instagram de Navalcarnero. Decide cuáles anuncian una ACTIVIDAD para el vecino: algo a lo que puede APUNTARSE o en lo que puede PARTICIPAR — torneos, carreras, marchas, cursos, talleres, campamentos, pruebas deportivas (aunque la inscripción sea el mismo día de la prueba).

Devuelve titulo="" para descartar un cartel que no sea una actividad: portadas genéricas ("PROGRAMACIÓN DEPORTIVA EN AGOSTO"), actos a los que solo se asiste como público (conciertos, proyecciones), avisos y carteles sin actividad concreta.

Para cada cartel devuelve:
- indice: el del candidato, copiado tal cual.
- titulo: el nombre de la actividad, corto y legible (sin mayúsculas gritadas).
- categoria: la más apropiada de la lista permitida ("deporte" para pruebas deportivas); "" si se descarta.
- fechaLimite: YYYY-MM-DD del fin del plazo de inscripción si el cartel lo indica; si no lo indica pero la prueba es de un día, la fecha de la prueba. El post se publicó el ${ancla} (hoy es ${hoy}): resuelve fechas sin año con ese ancla. "" si no hay fecha. Usa SOLO fechas que aparezcan en el texto — no inventes.
- horario: el horario del cartel (p. ej. "a partir de las 10.00h"); "" si no consta.
- lugar: la instalación o ubicación del cartel; "" si no consta.`

  try {
    const respuesta = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: instrucciones,
      output_config: { format: { type: 'json_schema', schema: ESQUEMA_CARRUSEL } },
      messages: [{ role: 'user', content: JSON.stringify(candidatos) }],
    })
    if (respuesta.stop_reason === 'refusal' || respuesta.stop_reason === 'max_tokens') {
      console.warn(`[extraerDeCarrusel] Respuesta no utilizable (${respuesta.stop_reason})`)
      return []
    }
    const texto = respuesta.content.find((b) => b.type === 'text')?.text || '{"actividades":[]}'
    const indicesValidos = new Set(candidatos.map((c) => c.indice))
    return (JSON.parse(texto).actividades || [])
      .filter(
        (a) =>
          Number.isInteger(a.indice) &&
          indicesValidos.has(a.indice) &&
          typeof a.titulo === 'string' &&
          a.titulo.trim()
      )
      .map((a) => ({
        indice: a.indice,
        titulo: a.titulo.trim().slice(0, 200),
        categoria: CATEGORIAS_ACTIVIDAD.includes(a.categoria) ? a.categoria : 'general',
        fechaLimite: /^\d{4}-\d{2}-\d{2}$/.test(a.fechaLimite) ? a.fechaLimite : null,
        horario: String(a.horario || '').trim().slice(0, 120) || null,
        lugar: String(a.lugar || '').trim().slice(0, 120) || null,
      }))
      // Plazos ya vencidos fuera, como en el PDF.
      .filter((a) => !a.fechaLimite || a.fechaLimite >= hoy)
  } catch (err) {
    console.error('[extraerDeCarrusel] Error:', err.message)
    return []
  }
}

/**
 * Punto de entrada único para una programación enlazada: HTML (galerías,
 * solo actividades) o PDF (agenda completa, eventos + actividades).
 * `doc` viene de descargarDocumento() en el webhook: {tipo, html|buffer}.
 */
export async function extraerDeDocumento(doc, urlFuente, imagenFallback, shortCode) {
  if (doc.tipo === 'pdf') {
    const resultado = await extraerDePdf(doc.buffer, shortCode)
    for (const act of resultado.actividades) {
      if (!act.imagen_url) act.imagen_url = imagenFallback || null
    }
    return resultado
  }
  const actividades = await extraerActividadesDeHTML(doc.html, urlFuente, imagenFallback, shortCode)
  return { eventos: [], actividades }
}
