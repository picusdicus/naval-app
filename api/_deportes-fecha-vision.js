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
// EL AÑO NO SE LE PIDE AL MODELO. Incidente 2026-08-31: en producción
// (claude-haiku-4-5 vía el ANTHROPIC_MODEL compartido) el modelo ignoró la
// instrucción "asume 2026" del prompt y devolvió el año "natural" de su
// entrenamiento (2024); la antigua guarda ajustarAñoRollover solo sumaba +1
// año, así que 18 carteles salieron con 2025 y dejaron de emparejar con el
// programa (16→11 emparejados). El modelo ahora devuelve solo DÍA y MES
// (leerlos del cartel es trivial para cualquier modelo) y el año lo calcula
// fechaConAñoDeterminista() en código, como única fuente de verdad.
//
// Solo Node (SDK de Anthropic): lo importa el feed de deportes, que solo se
// ejecuta desde api/sync-events.js (Node) y scripts locales.

import Anthropic from '@anthropic-ai/sdk'

// Modelo AISLADO de la variable ANTHROPIC_MODEL compartida con los webhooks:
// el mismo incidente de arriba enseñó que un cambio de modelo pensado para el
// triaje de posts (donde Haiku rinde bien) degradaba en silencio esta
// extracción. Cambiar el modelo de esta feature es una decisión propia:
// ANTHROPIC_MODEL_DEPORTES_VISION (opcional; sin ella, opus).
const MODEL = process.env.ANTHROPIC_MODEL_DEPORTES_VISION || 'claude-opus-4-8'

// Pocas imágenes a la vez: el cron ya hace muchas cosas y el CDN del
// Ayuntamiento no merece una ráfaga de 21 descargas simultáneas.
const CONCURRENCIA = 5

const ESQUEMA_FECHA = {
  type: 'object',
  properties: {
    dia: { type: ['integer', 'null'] },
    mes: { type: ['integer', 'null'] },
    confianza: { type: 'string', enum: ['alta', 'baja'] },
  },
  required: ['dia', 'mes', 'confianza'],
  additionalProperties: false,
}

const PROMPT_FECHA = `Esta imagen es el cartel de una actividad deportiva municipal de Navalcarnero.
Extrae ÚNICAMENTE el día y el mes de celebración del acto rotulados en el cartel.

Reglas:
- dia: número de día del mes (1-31). mes: número de mes (1-12; "septiembre" = 9).
- NO devuelvas ningún año: no se te pide.
- Si el cartel muestra un rango de varios días, devuelve el día de inicio.
- Si la única fecha visible es un plazo de inscripción ("inscripciones hasta el..."), NO es la fecha del acto: devuelve dia y mes null.
- Si no hay ninguna fecha de celebración legible, devuelve dia y mes null.
- confianza: "alta" si la fecha está rotulada de forma clara e inequívoca; "baja" si es dudosa, está parcialmente tapada o has tenido que deducirla.`

// Un cartel puede seguir colgado en la galería unas semanas después de su
// acto, así que una fecha hasta 60 días anterior a la publicación es creíble
// con el año base; más atrás, es el acto del año siguiente (cartel publicado
// en diciembre para un acto de enero).
const MARGEN_ROLLOVER_MS = 60 * 24 * 60 * 60 * 1000

/**
 * Construye la fecha ISO a partir del día y mes del cartel, calculando el año
 * ÍNTEGRAMENTE en código (única fuente de verdad — al modelo no se le pide):
 * añoBase, salvo que el mes/día caiga más de 60 días antes de la publicación
 * del cartel, en cuyo caso es el año siguiente. Valida que el día exista en
 * ese mes (rechaza 31 de febrero). Devuelve 'YYYY-MM-DD' o null.
 */
export function fechaConAñoDeterminista(dia, mes, { añoBase, fechaPublicacion } = {}) {
  if (!Number.isInteger(dia) || !Number.isInteger(mes)) return null
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null
  const año = Number.isInteger(añoBase) ? añoBase : new Date().getFullYear()

  const iso = (a) => `${a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  // Validación de fecha real: el roundtrip UTC detecta días inexistentes
  const existe = (a) => {
    const d = new Date(Date.UTC(a, mes - 1, dia))
    return d.getUTCFullYear() === a && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
  }
  if (!existe(año)) return null

  const pub = fechaPublicacion ? Date.parse(fechaPublicacion) : NaN
  if (!Number.isNaN(pub) && pub - Date.parse(iso(año)) > MARGEN_ROLLOVER_MS) {
    return existe(año + 1) ? iso(año + 1) : null
  }
  return iso(año)
}

/**
 * Extrae la fecha de celebración rotulada en la imagen de un cartel.
 * Devuelve { fecha: 'YYYY-MM-DD' | null, confianza: 'alta' | 'baja' }.
 * Fail-soft SIEMPRE: sin API key, imagen indescargable, respuesta no
 * parseable o día/mes inválidos ⇒ { fecha: null } — nunca lanza.
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
            { type: 'text', text: PROMPT_FECHA },
          ],
        },
      ],
    })
    if (respuesta.stop_reason === 'refusal') return { fecha: null, confianza: 'baja' }

    const texto = respuesta.content.find((b) => b.type === 'text')?.text || '{}'
    const datos = JSON.parse(texto)
    const fecha = fechaConAñoDeterminista(datos.dia, datos.mes, { añoBase, fechaPublicacion })
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
