// Parsing inteligente de HTML para extraer actividades con imágenes.
// Usa heurísticas para encontrar secciones de actividades + sus imágenes,
// luego enriquece con Claude y maneja fallbacks.

import Anthropic from '@anthropic-ai/sdk'
import { JSDOM } from 'jsdom'
import { subirImagen } from './_instagram.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

/**
 * Parsea el HTML buscando secciones con actividades + imágenes.
 * Retorna candidatos con: titulo, imagenUrl, imagenAlt, htmlSeccion.
 */
function parseHtmlInteligente(html) {
  try {
    const dom = new JSDOM(html)
    const doc = dom.window.document

    // Heurística 1: secciones con clases explícitas de actividad/evento
    let secciones = Array.from(
      doc.querySelectorAll(
        '[class*="actividad" i], [class*="evento" i], [class*="event" i], article, [class*="card" i]'
      )
    )

    // Heurística 2: si hay pocas, buscar por encabezados grandes + contenedor
    if (secciones.length < 3) {
      const encabezados = doc.querySelectorAll('h2, h3, h4')
      const porEncabezado = []
      for (const h of encabezados) {
        const contenedor = h.closest('section, div[class*="card"], div[class*="item"], article, div[style*="border"]')
        if (contenedor && !porEncabezado.includes(contenedor)) {
          porEncabezado.push(contenedor)
        }
      }
      if (porEncabezado.length > 0) secciones = porEncabezado
    }

    // Extraer datos de cada sección
    const actividades = []
    for (const sec of secciones) {
      const titulo = sec.querySelector('h2, h3, h4, [class*="titulo" i]')?.textContent?.trim()
      if (!titulo || titulo.length < 5) continue // Descartar títulos muy cortos

      const img = sec.querySelector('img')
      const imagenUrl = img?.src
      const imagenAlt = img?.alt

      // Limitar el HTML de la sección para no saturar Claude (máx 1500 chars)
      const htmlSeccion = sec.innerHTML.substring(0, 1500)

      actividades.push({
        titulo,
        imagenUrl,
        imagenAlt,
        htmlSeccion,
      })
    }

    return actividades
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

  const prompt = `Eres un experto en extracción de datos. Se te proporciona una lista de candidatos de actividades extraídas de HTML.

Tu tarea: para cada uno, estandariza y enriquece los datos. Retorna un array JSON.

Campos esperados:
- titulo: string, limpio y sin mayúsculas gritadas
- categoria: enum de ['deporte', 'talleres', 'infantil', 'mayores', 'educacion', 'ayudas', 'empleo', 'general']
- fechaLimite: string YYYY-MM-DD del plazo de inscripción, o null si no se encuentra
- horario: string ej "19:30-22:30h" u "hora TBD", o null
- lugar: string con ubicación o instalación, o null
- imagenValida: boolean — ¿la imagen (alt text o contexto) parece ser de esta actividad? true/false
- imagenUrl: mantener si imagenValida=true, o null

Si el candidato no es claramente una actividad (es publicidad, encabezado general, etc), devuélvelo con titulo=null para descartarlo.

Candidatos a procesar:
${JSON.stringify(
  candidatos.map((c) => ({
    titulo: c.titulo,
    imagenAlt: c.imagenAlt,
    htmlParcial: c.htmlSeccion.substring(0, 400), // Primeros 400 chars para contexto
  })),
  null,
  2
)}

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
  // Mapear validadas con candidatos originales para obtener URLs reales
  const candidatoPorTitulo = new Map(
    candidatos.map((c) => [c.titulo.toLowerCase().slice(0, 30), c])
  )

  for (const act of validadas) {
    const candidato = candidatoPorTitulo.get(act.titulo.toLowerCase().slice(0, 30))
    const imagenUrlCandidato = candidato?.imagenUrl

    if (act.imagenValida && imagenUrlCandidato) {
      try {
        act.imagen_url = await subirImagen('instagram-actividades', shortCode, imagenUrlCandidato)
      } catch (err) {
        console.warn(`[extraerActividadesDeHTML] Fallo upload imagen ${shortCode}: ${err.message}`)
        act.imagen_url = imagenPostInstagram // Fallback
      }
    } else {
      act.imagen_url = imagenPostInstagram // Fallback si no es válida
    }

    // Limpieza: no enviar campos internos a la DB
    delete act.imagenValida
    delete act.imagenUrl
  }

  return validadas
}
