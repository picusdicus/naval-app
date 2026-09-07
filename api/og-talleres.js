// GET /api/og-talleres[?id=<uuid de taller>] — devuelve el index.html del SPA
// con los meta Open Graph/Twitter reescritos para la sección de talleres:
// sin `id`, los del catálogo entero (/talleres); con `id`, los de esa ficha.
//
// Igual que api/og-evento.js, a esta función NO llegan los navegadores de los
// vecinos: el rewrite de vercel.json solo enruta aquí cuando el User-Agent es
// de un crawler de previsualización (WhatsApp, Slack, Telegram…). Un vecino
// recibe el SPA de siempre, sin latencia añadida ni un punto de fallo nuevo.
//
// Comparte por diseño todas las decisiones de og-evento (leer el index.html
// real en vez de una plantilla propia, fail-soft con timeout, 200 y nunca 404,
// reenvío de la cabecera de bypass): lo que cambia es de dónde salen título,
// descripción e imagen. No se factorizó en un módulo común a propósito — son
// ~120 líneas de las que la mitad son literales de meta, y un helper
// compartido acabaría con un parámetro por diferencia.
export const config = { runtime: 'edge' }

import { CUOTA_MATRICULA, nombreCategoriaTaller, tallerComoEvento, textoTurno } from '../src/lib/talleres.js'
import { genericasParaEvento, imagenEvento } from '../src/lib/imagenesEvento.js'

const TIMEOUT_MS = 8000
const MAX_DESCRIPCION = 200

const TITULO_SECCION = 'Talleres municipales de Navalcarnero'

function escapar(txt) {
  return String(txt ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function resumir(txt, tope = MAX_DESCRIPCION) {
  const limpio = String(txt ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (limpio.length <= tope) return limpio
  const corte = limpio.slice(0, tope)
  const ultimo = corte.lastIndexOf(' ')
  return `${(ultimo > 40 ? corte.slice(0, ultimo) : corte).trim()}…`
}

function cabecerasInternas(req) {
  const bypass = req.headers.get('x-vercel-protection-bypass')
  return bypass ? { 'x-vercel-protection-bypass': bypass } : undefined
}

/** Fetch con timeout que nunca lanza: devuelve `porDefecto` si algo falla. */
async function json(url, porDefecto, headers) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!r.ok) return porDefecto
    return await r.json()
  } catch {
    return porDefecto
  }
}

/**
 * Descripción del catálogo: cuántos talleres hay y algunas disciplinas, para
 * que la burbuja diga algo concreto en vez de un reclamo genérico. Con la lista
 * vacía (Neon caído) se cae a una frase fija — nunca se deja sin descripción,
 * que en WhatsApp sale como una burbuja con el título flotando.
 */
function descripcionDelCatalogo(talleres) {
  if (talleres.length === 0) {
    return `Cursos y talleres municipales de Navalcarnero. Matrícula de ${CUOTA_MATRICULA}, aparte de la cuota mensual.`
  }
  // Disciplinas distintas, en el orden en que aparecen: las primeras bastan
  // para que se entienda de qué va sin enumerar las doce.
  const disciplinas = [...new Set(talleres.map((t) => nombreCategoriaTaller(t.categoria)))]
  const muestra = disciplinas.slice(0, 5).join(', ')
  const y_mas = disciplinas.length > 5 ? ' y más' : ''
  return resumir(
    `${talleres.length} talleres este curso: ${muestra}${y_mas}. Matrícula de ${CUOTA_MATRICULA} aparte de la cuota mensual.`,
  )
}

/** Descripción de una ficha: primer turno + lugar + precio, que es lo que se decide. */
function descripcionDelTaller(taller) {
  const partes = []
  if (taller.turnos?.[0]) partes.push(textoTurno(taller.turnos[0]))
  if (taller.lugar) partes.push(taller.lugar)
  if (taller.precio) partes.push(`${taller.precio} + ${CUOTA_MATRICULA} de matrícula`)
  if (partes.length === 0) return descripcionDelCatalogo([])
  return resumir(partes.join(' · '))
}

/**
 * Imagen de la vista previa. Prioridad, la misma que en la app:
 *  - ficha: foto propia del taller > su ilustrativa de galería > la del catálogo
 *  - catálogo: la primera genérica activa de la categoría 'talleres' (estable:
 *    el endpoint las ordena por categoría/disciplina/creado_en)
 *  - sin ninguna: el logo, como cualquier otra página.
 *
 * ⚠️ Mismo aviso que en og-evento: al subir genéricas, evitar caras
 * protagonistas reconocibles — la burbuja no lleva el pie "imagen ilustrativa"
 * que sí muestra la ficha.
 */
function imagenDe(taller, origen, genericas, asignaciones) {
  if (taller) {
    if (taller.imagen) return { url: taller.imagen, esLogo: false }
    const comoEvento = tallerComoEvento(taller)
    const ilustrativa = imagenEvento(comoEvento, {
      genericas: genericasParaEvento(comoEvento, genericas, asignaciones),
    })
    if (ilustrativa?.src) return { url: ilustrativa.src, esLogo: false }
  }

  const deTalleres = (genericas || []).find((g) => g.categoria === 'talleres' && g.url)
  if (deTalleres) return { url: deTalleres.url, esLogo: false }

  return { url: `${origen}/logo.png`, esLogo: true }
}

function inyectarMeta(html, meta) {
  const limpio = html
    .replace(/\s*<meta\s+property="og:[^"]*"[^>]*>/gi, '')
    .replace(/\s*<meta\s+name="twitter:[^"]*"[^>]*>/gi, '')
    .replace(/\s*<meta\s+name="description"[^>]*>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, '')

  const bloque = meta.map((l) => `    ${l}`).join('\n')
  return limpio.replace(/<\/head>/i, `${bloque}\n  </head>`)
}

export default async function handler(req) {
  const url = new URL(req.url)
  const origen = url.origin
  const internas = cabecerasInternas(req)

  const traerIndex = () =>
    fetch(`${origen}/index.html`, {
      headers: internas,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).then((r) => r.text())

  const indexHtml = async () =>
    new Response(await traerIndex(), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })

  try {
    const id = url.searchParams.get('id')

    const [catalogo, ilustrativas] = await Promise.all([
      json(`${origen}/api/talleres`, { talleres: [] }, internas),
      json(`${origen}/api/imagenes-evento-genericas`, { imagenes: [], asignaciones: {} }, internas),
    ])
    const talleres = catalogo.talleres ?? []

    // Un id que no existe (taller despublicado o borrado) no es un error: se
    // comparte la sección, que es lo que el enlace acaba abriendo de todas
    // formas cuando el SPA no encuentra la ficha.
    const taller = id ? talleres.find((t) => t.id === id) : null

    const enlace = taller ? `${origen}/talleres/${taller.id}` : `${origen}/talleres`
    const titulo = taller ? `${taller.nombre} · Talleres municipales` : TITULO_SECCION
    const descripcion = taller ? descripcionDelTaller(taller) : descripcionDelCatalogo(talleres)
    const imagen = imagenDe(taller, origen, ilustrativas.imagenes, ilustrativas.asignaciones)

    const meta = [
      `<title>${escapar(titulo)} · En Navalcarnero</title>`,
      `<meta name="description" content="${escapar(descripcion)}" />`,
      `<meta property="og:type" content="${taller ? 'article' : 'website'}" />`,
      `<meta property="og:site_name" content="En Navalcarnero" />`,
      `<meta property="og:title" content="${escapar(titulo)}" />`,
      `<meta property="og:description" content="${escapar(descripcion)}" />`,
      `<meta property="og:url" content="${escapar(enlace)}" />`,
      `<meta property="og:image" content="${escapar(imagen.url)}" />`,
      `<meta property="og:locale" content="es_ES" />`,
      // Del logo sabemos que es 1024² y conviene declararlo; de una foto de
      // Blob no sabemos las dimensiones sin descargarla: no se inventan.
      ...(imagen.esLogo
        ? [
            `<meta property="og:image:type" content="image/png" />`,
            `<meta property="og:image:width" content="1024" />`,
            `<meta property="og:image:height" content="1024" />`,
          ]
        : []),
      `<meta name="twitter:card" content="${imagen.esLogo ? 'summary' : 'summary_large_image'}" />`,
      `<meta name="twitter:title" content="${escapar(titulo)}" />`,
      `<meta name="twitter:description" content="${escapar(descripcion)}" />`,
      `<meta name="twitter:image" content="${escapar(imagen.url)}" />`,
    ]

    return new Response(inyectarMeta(await traerIndex(), meta), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Misma ventana que og-evento: un taller recién publicado debe poder
        // compartirse con su ficha en menos de un minuto.
        'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('No se pudo componer el Open Graph de talleres:', error)
    return await indexHtml()
  }
}
