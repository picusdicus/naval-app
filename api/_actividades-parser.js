// Parsing inteligente de HTML para extraer actividades con imágenes.
// Estrategia: buscar imágenes en galerías + sus alt texts (que frecuentemente
// contienen títulos de actividades), luego enriquecer con Claude.

import Anthropic from '@anthropic-ai/sdk'
import { JSDOM } from 'jsdom'
import { subirImagen } from './_instagram.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

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

  const prompt = `Eres un experto en extracción de datos de actividades deportivas y culturales.

Se te proporciona una lista de títulos/nombres de actividades (extraídos del alt text de imágenes).
Para cada uno, retorna un objeto JSON estandarizado:

Campos:
- titulo: string limpio, normalizado (sin números de orden como "39. " si está presente)
- categoria: una de ['deporte', 'talleres', 'infantil', 'mayores', 'educacion', 'ayudas', 'empleo', 'general']
- fechaLimite: string YYYY-MM-DD del plazo de inscripción extraído del titulo, o null
  Ejemplo: si dice "2 Sept" y hoy es 2026-08-05, sería "2026-09-02"
- horario: string como "10:00h" u "hora TBD", o null
- lugar: string con ubicación/instalación, o null

Si el titulo no es una actividad clara, devuelve titulo=null para descartarlo.

IMPORTANTE: hoy es 2026-08-05. Resuelve fechas relativas.

Candidatos:
${JSON.stringify(candidatos.map((c) => ({ titulo: c.titulo })), null, 2)}

Retorna SOLO un array JSON válido, sin comentarios ni markdown.`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const texto = response.content.find((b) => b.type === 'text')?.text || '[]'
    const match = texto.match(/\[[\s\S]*\]/)
    if (!match) {
      console.warn('[validarConClaude] No valid JSON found in response')
      return []
    }

    const validadas = JSON.parse(match[0])
    // Filtrar nulls (descartados por Claude)
    return validadas.filter((a) => a.titulo)
  } catch (err) {
    console.error('[validarConClaude] Error:', err.message)
    return []
  }
}

/**
 * Orquesta el parsing, validación y enriquecimiento de actividades.
 * Sube imágenes a Blob y maneja fallbacks.
 */
export async function extraerActividadesDeHTML(html, urlFuente, imagenPostInstagram, shortCode) {
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

  for (const act of validadas) {
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
      // Usar directamente la URL del HTML (municipios suelen tener URLs duraderas)
      // Si hay Blob credentials y quieres cachear, descomenta el upload abajo
      act.imagen_url = imagenUrlCandidato

      // Opcional: intentar subir a Blob para cachear/proteger la URL
      // try {
      //   const urlBlob = await subirImagen('instagram-actividades', shortCode, imagenUrlCandidato)
      //   if (urlBlob) act.imagen_url = urlBlob
      // } catch (err) {
      //   console.warn(`[extraerActividadesDeHTML] Fallo upload imagen ${shortCode}: ${err.message}`)
      // }
    } else {
      // Sin imagen en el HTML: usar imagen del post
      act.imagen_url = imagenPostInstagram
    }
  }

  return validadas
}
