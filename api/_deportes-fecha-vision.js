// Extracción por visión de la FECHA de un cartel deportivo (y solo la fecha).
//
// Los carteles de la galería de Deportes llevan la fecha rotulada en la propia
// imagen ("DOMINGO, 6 DE SEPTIEMBRE"), pero muchos títulos de la galería no la
// repiten, así que la regex de _actividades-deportes-feed.js los dejaba con
// fecha_evento null y la agenda pública los ocultaba (proximosEventos filtra
// por fecha). Este módulo mira la imagen con Claude cuando la regex no pudo.
//
// Alcance deliberadamente estrecho: SOLO fecha, ni hora ni lugar ni
// organizador. Si la fecha nueva permite que emparejarCartelConPrograma
// resuelva, el programa oficial aporta todo lo demás; si no, el cartel sigue
// su flujo de siempre (grandfathered → JSON, nuevo → revisión).
//
// Solo Node (SDK de Anthropic): lo importa el feed de deportes, que solo se
// ejecuta desde api/sync-events.js (Node) y scripts locales.

import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

// Pocas imágenes a la vez: el cron ya hace muchas cosas y el CDN del
// Ayuntamiento no merece una ráfaga de 21 descargas simultáneas.
const CONCURRENCIA = 5

const ESQUEMA_FECHA = {
  type: 'object',
  properties: {
    fecha: { type: ['string', 'null'] },
    confianza: { type: 'string', enum: ['alta', 'baja'] },
  },
  required: ['fecha', 'confianza'],
  additionalProperties: false,
}

function promptFecha(añoBase, fechaPublicacion) {
  return `Esta imagen es el cartel de una actividad deportiva municipal de Navalcarnero.
Extrae ÚNICAMENTE la fecha de celebración del acto rotulada en el cartel.

Reglas:
- Devuelve la fecha en formato ISO YYYY-MM-DD.
- Si el cartel no indica el año explícitamente: el cartel se publicó alrededor del ${fechaPublicacion}; asume ${añoBase}, salvo que ese mes ya hubiera pasado claramente respecto a la fecha de publicación (un cartel publicado en diciembre para un acto de enero es del año siguiente).
- Si el cartel muestra un rango de varios días, devuelve el día de inicio.
- Si la única fecha visible es un plazo de inscripción ("inscripciones hasta el..."), NO es la fecha del acto: devuelve null.
- Si no hay ninguna fecha de celebración legible, devuelve null.
- confianza: "alta" si la fecha está rotulada de forma clara e inequívoca; "baja" si es dudosa, está parcialmente tapada o has tenido que deducirla.`
}

// Guarda determinista del cambio de año, por si el modelo ignora la regla del
// prompt: una fecha más de 60 días ANTERIOR a la publicación del cartel no es
// creíble (la galería anuncia actos futuros o muy recientes) — es el acto del
// año siguiente con el año en curso mal asumido (cartel de diciembre para un
// acto de enero). 60 días deja margen a los carteles que siguen colgados unas
// semanas después de su acto, que sí existen.
const MARGEN_ROLLOVER_MS = 60 * 24 * 60 * 60 * 1000

export function ajustarAñoRollover(fecha, fechaPublicacion) {
  if (!fecha || !fechaPublicacion) return fecha
  const f = Date.parse(fecha)
  const pub = Date.parse(fechaPublicacion)
  if (Number.isNaN(f) || Number.isNaN(pub)) return fecha
  if (pub - f > MARGEN_ROLLOVER_MS) {
    return `${Number(fecha.slice(0, 4)) + 1}${fecha.slice(4)}`
  }
  return fecha
}

/**
 * Extrae la fecha de celebración rotulada en la imagen de un cartel.
 * Devuelve { fecha: 'YYYY-MM-DD' | null, confianza: 'alta' | 'baja' }.
 * Fail-soft SIEMPRE: sin API key, imagen indescargable, respuesta no
 * parseable o fecha mal formada ⇒ { fecha: null } — nunca lanza.
 */
export async function extraerFechaDeCartel(urlImagen, { añoBase, fechaPublicacion } = {}) {
  // Sin credencial no hay llamada: los scripts de diagnóstico que importan el
  // feed (scripts/contar-duplicados*, etc.) no cargan .env y así siguen siendo
  // gratis — mismo principio que "un diagnóstico no crea borradores reales".
  if (!process.env.ANTHROPIC_API_KEY) return { fecha: null, confianza: 'baja' }

  try {
    const res = await fetch(urlImagen, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return { fecha: null, confianza: 'baja' }
    const buffer = Buffer.from(await res.arrayBuffer())
    const mediaType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()

    const client = new Anthropic()
    const respuesta = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      output_config: { format: { type: 'json_schema', schema: ESQUEMA_FECHA } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
            },
            {
              type: 'text',
              text: promptFecha(
                añoBase || new Date().getFullYear(),
                fechaPublicacion || new Date().toISOString().slice(0, 10)
              ),
            },
          ],
        },
      ],
    })
    if (respuesta.stop_reason === 'refusal') return { fecha: null, confianza: 'baja' }

    const texto = respuesta.content.find((b) => b.type === 'text')?.text || '{}'
    const datos = JSON.parse(texto)
    let fecha = typeof datos.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) ? datos.fecha : null
    fecha = ajustarAñoRollover(fecha, fechaPublicacion)
    const confianza = datos.confianza === 'alta' ? 'alta' : 'baja'
    // usage viaja para poder auditar el coste real por run (el feed lo ignora).
    return { fecha, confianza, usage: respuesta.usage }
  } catch (err) {
    console.warn(`[deportes-vision] fallo con ${urlImagen}: ${err.message}`)
    return { fecha: null, confianza: 'baja' }
  }
}

/**
 * Versión por lotes con concurrencia limitada. Recibe un array de URLs y
 * devuelve un array de resultados en el MISMO orden (índice a índice).
 */
export async function extraerFechasDeCarteles(urls, { añoBase, fechaPublicacion } = {}) {
  const resultados = new Array(urls.length)
  let siguiente = 0
  async function trabajador() {
    while (siguiente < urls.length) {
      const i = siguiente++
      resultados[i] = await extraerFechaDeCartel(urls[i], { añoBase, fechaPublicacion })
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, urls.length) }, trabajador))
  return resultados
}
