#!/usr/bin/env node
/**
 * Dry-run del pipeline de sync-instagram.js:
 * Normaliza un post de Instagram y lo envía a Claude para capturar la respuesta cruda.
 * No escribe en Neon, solo captura el JSON del modelo.
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'

// Helpers duplicados de api/_instagram.js (solo los que necesitamos para normalizar)
function altUtil(alt) {
  const limpio = typeof alt === 'string' ? alt.trim() : ''
  const ALT_GENERICO_RE = /^Photo by .+ on \w+ \d{1,2}, \d{4}\.?$/i
  if (!limpio || ALT_GENERICO_RE.test(limpio)) return ''
  return limpio
}

function carruselDe(post) {
  if (!Array.isArray(post.childPosts)) return []
  return post.childPosts
    .map((c) => ({
      alt: typeof c?.alt === 'string' ? c.alt.trim() : '',
      imagen: c?.displayUrl || '',
      id: c?.shortCode || c?.id || '',
    }))
    .filter((c) => c.alt || c.imagen)
}

function primeraImagen(post) {
  if (Array.isArray(post.images) && post.images[0]) return post.images[0]
  if (Array.isArray(post.childPosts) && post.childPosts[0]?.displayUrl) {
    return post.childPosts[0].displayUrl
  }
  return post.displayUrl || post.imageUrl || post.thumbnailUrl || post.image || ''
}

function todasLasImagenes(post) {
  if (Array.isArray(post.images) && post.images.length > 0) {
    const urls = post.images.filter(Boolean)
    if (urls.length > 0) return urls
  }
  if (Array.isArray(post.childPosts) && post.childPosts.length > 0) {
    const urls = post.childPosts.map((c) => c?.displayUrl).filter(Boolean)
    if (urls.length > 0) return urls
  }
  const unica = primeraImagen(post)
  return unica ? [unica] : []
}

function shortCodeDe(post) {
  if (typeof post.shortCode === 'string' && post.shortCode.trim()) {
    return post.shortCode.trim()
  }
  const m = String(post.url || '').match(/\/(?:p|reel|tv)\/([^/?#]+)/)
  return m ? m[1] : ''
}

function altCompletoDe(post) {
  const partes = []
  const altPadre = altUtil(post.alt)
  if (altPadre) partes.push(altPadre)

  if (Array.isArray(post.childPosts)) {
    post.childPosts.slice(0, 10).forEach((hijo, indice) => {
      const altHijo = altUtil(hijo?.alt)
      if (altHijo) partes.push(`[Imagen ${indice + 1}] ${altHijo}`)
    })
  }

  let texto = partes.join('\n')
  if (texto.length > 4000) texto = texto.slice(0, 4000).trimEnd() + '…'
  return texto
}

function normalizarPost(post) {
  if (!post || typeof post !== 'object') return null
  const shortCode = shortCodeDe(post)
  const caption = typeof post.caption === 'string' ? post.caption.trim() : ''
  if (!shortCode || !caption) return null
  return {
    shortCode,
    caption,
    alt: altCompletoDe(post),
    publicado: post.timestamp || '',
    url: post.url || `https://www.instagram.com/p/${shortCode}/`,
    imagen: primeraImagen(post),
    imagenes: todasLasImagenes(post),
    carrusel: carruselDe(post),
    usuario: post.ownerUsername || '',
  }
}

// Schema exacto del handler
const ESQUEMA_EXTRACCION = {
  type: 'object',
  additionalProperties: false,
  required: ['eventos'],
  properties: {
    eventos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['shortCode', 'titulo', 'fecha', 'hora', 'lugar', 'categoria', 'subcategoria', 'descripcion'],
        properties: {
          shortCode: { type: 'string' },
          titulo: { type: 'string' },
          fecha: { type: 'string' },
          hora: { type: 'string' },
          lugar: { type: 'string' },
          categoria: { enum: ['cultura', 'deporte', 'fiestas', 'gastronomia', 'infantil', 'mercado'] },
          subcategoria: { enum: ['teatro', 'cine', 'musica', 'danza', 'exposicion', 'otros', ''] },
          descripcion: { type: 'string' },
          indiceCartel: { type: ['integer', 'null'] },
        },
      },
    },
  },
}

const INSTRUCCIONES = `Analiza posts de Instagram de cuentas municipales de Navalcarnero (Madrid) — la concejalía de cultura y el Ayuntamiento — e identifica cuáles anuncian un EVENTO REAL al que un vecino puede asistir.

Un post es un evento SOLO si menciona explícitamente las tres cosas: una fecha concreta, una hora y un lugar. Pueden aparecer en el caption o en el texto del cartel (campo "alt", la descripción automática de la imagen) — es habitual que el caption sea solo la sinopsis y los datos prácticos estén en el cartel.

Además, un evento de agenda es un ACTO al que el vecino asiste en un momento concreto como público o participante: una función, un concierto, una proyección, una fiesta, un mercado, una carrera popular, un encierro. Tener fecha, hora y lugar NO basta. Descarta aunque los tengan:
- Aperturas de plazos de inscripción y bases de concursos (cursos de natación, talleres, campamentos).
- Campañas y servicios: donaciones de sangre, sorteos comerciales, custodia de llaves, objetos perdidos.
- Horarios de temporada o de instalaciones (piscina municipal, biblioteca, polideportivo).
- Noticias, agradecimientos, balances y comunicados.
- Actos fuera de Navalcarnero.

Para cada evento devuelve:
- shortCode: el del post, copiado tal cual.
- titulo: corto y legible en español (sin mayúsculas gritadas).
- fecha: YYYY-MM-DD. Resuelve fechas relativas ("este sábado 18") con el campo "publicado" del post. Si el evento dura varios días, usa el día de inicio.
- hora: HH:MM en formato 24 h.
- lugar: el nombre del sitio tal como aparece (sin ", Navalcarnero").
- categoria: la más apropiada de la lista permitida.
- subcategoria: SOLO si categoria es "cultura", el tipo concreto de acto: "teatro", "cine", "musica" (conciertos, recitales), "danza", "exposicion", u "otros" si es cultural pero no encaja en ninguno. Para cualquier otra categoria, "".
- descripcion: el caption limpio de hashtags y menciones, máximo 400 caracteres.
- indiceCartel: null normalmente. SOLO si los datos del evento (fecha, hora, lugar, descripción) provienen explícitamente del alt de un cartel específico marcado como "[Imagen N]" (donde N es 1, 2, 3…), devuelve N-1 (es decir, el índice: 0 para [Imagen 1], 1 para [Imagen 2], etc.). Si provienen del caption general del post o es ambiguo, deja null.

Devuelve solo los posts que son eventos; si ninguno lo es, devuelve la lista vacía.`

async function main() {
  console.log('=== DRY-RUN: Claude extracción de eventos ===\n')

  // Leer el dataset: desde archivo o desde stdin
  let datasetRaw
  if (process.argv[2]) {
    datasetRaw = readFileSync(process.argv[2], 'utf-8')
  } else {
    // Fallback: leer stdin si está disponible
    datasetRaw = readFileSync(0, 'utf-8')
  }
  const dataset = JSON.parse(datasetRaw)

  // Filtrar solo el post DciM41sD_3r
  const postOriginal = dataset.find((p) => p.shortCode === 'DciM41sD_3r')
  if (!postOriginal) {
    console.error('❌ No se encontró el post DciM41sD_3r en el dataset')
    process.exit(1)
  }

  console.log('📍 Post encontrado: DciM41sD_3r')
  console.log(`   Caption: "${postOriginal.caption.slice(0, 80)}..."\n`)

  // Normalizar
  const postNormalizado = normalizarPost(postOriginal)
  console.log('✓ Normalizado')
  console.log(`   alt resumido: "${postNormalizado.alt.slice(0, 100)}..."\n`)

  // Mostrar imágenes del carrusel
  console.log('📸 Imágenes del carrusel:')
  postOriginal.childPosts.forEach((child, idx) => {
    console.log(`   [Imagen ${idx + 1}] ${child.shortCode}`)
    console.log(`      → ${child.displayUrl.slice(0, 100)}...`)
  })
  console.log()

  // Enviar a Claude
  console.log('🤖 Enviando a Claude (Opus 4.8)...\n')
  const client = new Anthropic()

  const respuesta = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8192,
    system: INSTRUCCIONES,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_EXTRACCION } },
    messages: [{ role: 'user', content: JSON.stringify([postNormalizado]) }],
  })

  // Extraer JSON crudo
  const textoJson = respuesta.content.find((b) => b.type === 'text')?.text || '{}'
  const resultado = JSON.parse(textoJson)

  console.log('=== RESPUESTA DE CLAUDE (JSON crudo) ===\n')
  console.log(JSON.stringify(resultado, null, 2))
  console.log('\n=== ANÁLISIS ===\n')

  if (resultado.eventos.length === 0) {
    console.log('⚠️  No se extrajeron eventos')
  } else {
    console.log(`✓ Se extrajeron ${resultado.eventos.length} eventos:\n`)
    resultado.eventos.forEach((ev, idx) => {
      console.log(`${idx + 1}. ${ev.titulo}`)
      console.log(`   Fecha/Hora: ${ev.fecha} ${ev.hora}`)
      console.log(`   Lugar: ${ev.lugar}`)
      console.log(`   Categoría: ${ev.categoria}`)
      console.log(`   indiceCartel: ${ev.indiceCartel !== null ? ev.indiceCartel : 'null (del caption)'}`)
      if (ev.indiceCartel !== null) {
        const img = postOriginal.childPosts[ev.indiceCartel]
        console.log(`   ↳ Proviene de [Imagen ${ev.indiceCartel + 1}] (${img.shortCode})`)
      }
      console.log()
    })
  }

  console.log('=== IMÁGENES DEL CARRUSEL (para revisión) ===\n')
  postOriginal.childPosts.forEach((child, idx) => {
    console.log(`[Imagen ${idx + 1}] ${child.shortCode}`)
    console.log(`URL: ${child.displayUrl}\n`)
  })
}

main().catch((err) => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
