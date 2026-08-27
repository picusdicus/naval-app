// GET /api/og-evento?id=<id de evento> — devuelve el index.html del SPA con los
// meta Open Graph/Twitter reescritos para UN evento concreto.
//
// A esta función NO llegan los navegadores de los vecinos: el rewrite de
// vercel.json solo enruta aquí cuando el User-Agent es de un crawler de
// previsualización (WhatsApp, Slack, Telegram…). Ver api/_crawlers.js.
//
// Edge: el driver HTTP de Neon ya va sobre fetch (mismo motivo que
// api/eventos.js) y el bundle de Edge incluye los JSON importados, que en Node
// serverless no siempre resuelven (ver el caso de api/_datos/ en CLAUDE.md).
export const config = { runtime: 'edge' }

import eventosCurados from '../src/data/eventos.json' with { type: 'json' }
import eventosExternos from '../src/data/eventos-externos.json' with { type: 'json' }
import { combinarEventos, enriquecerPorCartel } from '../src/lib/dedupEventos.js'
import { formatearFechaLarga } from '../src/lib/eventos.js'

const MAX_DESCRIPCION = 200

// Un crawler que espera cuelga la burbuja de la vista previa: antes de eso,
// preferimos servir el index.html genérico. Cubre Neon lento o caído.
const TIMEOUT_MS = 3000

// El mismo literal que lleva el index.html: si el evento no da ni descripción
// ni lugar ni fecha, la vista previa dice lo que diría cualquier otra página.
const DESCRIPCION_GENERICA =
  'Portal vecinal de Navalcarnero: agenda de eventos, guía local, noticias y asistente IA.'

function escapar(txt) {
  return String(txt ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Los meta no admiten saltos ni HTML; se recorta por palabra para no cortar a
// mitad, que es lo que se ve en la burbuja de WhatsApp.
function resumir(txt, tope = MAX_DESCRIPCION) {
  const limpio = String(txt ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (limpio.length <= tope) return limpio
  const corte = limpio.slice(0, tope)
  const ultimo = corte.lastIndexOf(' ')
  return `${(ultimo > tope * 0.6 ? corte.slice(0, ultimo) : corte).trimEnd()}…`
}

// Prioridad decidida: descripción propia > lugar + fecha larga > el genérico
// del index.html. Nunca se deja vacío, que en WhatsApp sale como una burbuja
// con el título flotando.
//
// Guarda de fecha: hay 21 eventos reales sin ella (carteles de deportes) y
// formatearFechaLarga revienta con "Invalid time value" si se la pasas ausente.
function descripcionDe(evento) {
  const propia = resumir(evento.descripcion)
  if (propia) return propia

  const partes = []
  if (evento.lugar) partes.push(evento.lugar)
  if (evento.fecha) partes.push(formatearFechaLarga(evento.fecha))
  if (partes.length) return partes.join(' · ')

  return DESCRIPCION_GENERICA
}

// og:image exige URL absoluta: 42 eventos curados llevan la imagen relativa
// ('/img/eventos/…') y así WhatsApp no la resolvería.
function imagenAbsoluta(evento, origen) {
  const bruta = evento.imagen || ''
  if (!bruta) return { url: `${origen}/logo.png`, propia: false }
  if (/^https?:\/\//i.test(bruta)) return { url: bruta, propia: true }
  return { url: `${origen}${bruta.startsWith('/') ? '' : '/'}${bruta}`, propia: true }
}

// Fail-soft con timeout: si Neon tarda o se cae, este origen aporta una lista
// vacía y el merge sigue con los demás. En el peor caso no se encuentra el
// evento y se acaba sirviendo el index.html genérico, nunca un error.
async function json(url, clave, porDefecto) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!r.ok) return porDefecto
    return (await r.json())[clave] ?? porDefecto
  } catch {
    return porDefecto
  }
}

// Mismo pipeline que src/lib/useEventosPublicos.js: si divergen, la vista
// previa enseñaría algo distinto de lo que ve quien pincha el enlace.
async function eventoPorId(id, origen) {
  const [deLaBase, actividades, ocultos] = await Promise.all([
    json(`${origen}/api/eventos`, 'eventos', []),
    json(`${origen}/api/actividades`, 'actividades', []),
    json(`${origen}/api/eventos-ocultos`, 'ocultos', []),
  ])

  const deActividades = actividades
    .filter((a) => a.fecha_evento || a.fecha_limite)
    .map((a) => ({
      id: a.id,
      titulo: a.titulo,
      fecha: a.fecha_evento || a.fecha_limite,
      hora: a.horario,
      lugar: a.lugar,
      categoria: a.categoria,
      descripcion: a.descripcion || '',
      imagen: a.imagen_url,
      url: a.url_fuente,
      origen: 'actividad',
    }))

  const combinados = combinarEventos(
    enriquecerPorCartel([...eventosCurados, ...eventosExternos]),
    [...deLaBase, ...deActividades],
  )

  const evento = combinados.find((e) => e.id === id || (e.idsSecundarios || []).includes(id))
  if (!evento) return null

  // Un evento que el superadmin ocultó no merece vista previa enriquecida.
  const escondidos = new Set(ocultos)
  if (escondidos.has(evento.id) || (evento.idsSecundarios || []).some((x) => escondidos.has(x))) {
    return null
  }
  return evento
}

// Se parte del index.html real (no de una plantilla propia) para que la vista
// previa lleve exactamente el mismo shell que sirve Vercel: si el build cambia
// los hashes de los assets, esto no se queda atrás.
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

  const traerIndex = () =>
    fetch(`${origen}/index.html`, { signal: AbortSignal.timeout(TIMEOUT_MS) }).then((r) => r.text())

  const indexHtml = async () =>
    new Response(await traerIndex(), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })

  try {
    const id = url.searchParams.get('id')
    if (!id) return await indexHtml()

    const evento = await eventoPorId(id, origen)
    // Evento inexistente, no publicado u oculto: el SPA sin tocar. Nunca un
    // 404 — el enlace puede estar pegado en un chat y debe seguir abriendo.
    if (!evento) return await indexHtml()

    const enlace = `${origen}/eventos/${evento.id}`
    const titulo = evento.titulo || 'En Navalcarnero'
    const descripcion = descripcionDe(evento)
    const imagen = imagenAbsoluta(evento, origen)

    const meta = [
      `<title>${escapar(titulo)} · En Navalcarnero</title>`,
      `<meta name="description" content="${escapar(descripcion)}" />`,
      `<meta property="og:type" content="article" />`,
      `<meta property="og:site_name" content="En Navalcarnero" />`,
      `<meta property="og:title" content="${escapar(titulo)}" />`,
      `<meta property="og:description" content="${escapar(descripcion)}" />`,
      `<meta property="og:url" content="${escapar(enlace)}" />`,
      `<meta property="og:image" content="${escapar(imagen.url)}" />`,
      `<meta property="og:locale" content="es_ES" />`,
      // Del logo sabemos que es cuadrado 1024 y conviene declararlo; de un
      // cartel real no sabemos las dimensiones sin descargarlo: no se inventan.
      ...(imagen.propia
        ? []
        : [
            `<meta property="og:image:type" content="image/png" />`,
            `<meta property="og:image:width" content="1024" />`,
            `<meta property="og:image:height" content="1024" />`,
          ]),
      // Tarjeta grande solo si hay cartel real; con el logo queda mejor la chica.
      `<meta name="twitter:card" content="${imagen.propia ? 'summary_large_image' : 'summary'}" />`,
      `<meta name="twitter:title" content="${escapar(titulo)}" />`,
      `<meta name="twitter:description" content="${escapar(descripcion)}" />`,
      `<meta name="twitter:image" content="${escapar(imagen.url)}" />`,
    ]

    const base = await traerIndex()
    return new Response(inyectarMeta(base, meta), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // 60 s, alineado con el cache de /api/eventos. Un evento recién
        // publicado y compartido al momento puede enseñar la vista previa
        // genérica hasta ~2 min (este cache + el del endpoint); ver CLAUDE.md.
        'Cache-Control': 'public, max-age=0, s-maxage=60',
      },
    })
  } catch (err) {
    console.error('og-evento:', err?.message)
    try {
      return await indexHtml()
    } catch {
      return new Response('', { status: 302, headers: { Location: `${origen}/` } })
    }
  }
}
