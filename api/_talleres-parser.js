// Extracción del catálogo de talleres municipales desde el PDF de horarios.
//
// Hermano de api/_actividades-parser.js, no una adaptación suya: comparte el
// patrón (documento entero a Claude como bloque `document` + structured output)
// pero el esquema es otro — un taller no tiene fecha ni plazo, tiene TURNOS
// semanales, precio mensual y edades. Meterlo en ESQUEMA_DOCUMENTO habría
// convertido aquel esquema en un cajón de sastre de tres formas distintas.
//
// El PDF del curso 2026/2027 es de texto real (no escaneado): 434 operadores
// de dibujo de texto y 6 fuentes embebidas en 180 KB. Por eso basta el bloque
// `document` y NO hace falta el pipeline de visión de _deportes-fecha-vision.js,
// que es para carteles en imagen. Un PDF escaneado futuro sería otra cosa.
//
// Todo lo que sale de aquí nace `borrador` en quien lo inserta
// (api/super/talleres-importar.js): un error de extracción no es un item, son
// decenas — el mismo criterio que rige para las actividades de documento.
//
// Solo Node: SDK de Anthropic y Buffer.

import Anthropic from '@anthropic-ai/sdk'
import { IDS_CATEGORIAS_TALLER, IDS_DIAS } from '../src/lib/talleres.js'
import { LIMITES } from '../src/lib/tallerForm.js'

// Modelo AISLADO de ANTHROPIC_MODEL (que hoy vale claude-haiku-4-5 en
// producción, compartido con el triaje de los webhooks). La lección está
// documentada en CLAUDE.md: en agosto de 2026 un cambio de ANTHROPIC_MODEL
// pensado para los webhooks degradó en silencio la extracción de fechas de
// deportes. Transcribir un folleto entero —14 talleres, 31 turnos, días y
// horas exactos— es justo donde un modelo más flojo se equivoca sin avisar, y
// aquí un error se convierte en un horario mal publicado.
const MODEL = process.env.ANTHROPIC_MODEL_TALLERES_PDF || 'claude-opus-4-8'

// El `enum` es lo que impide que el modelo invente una categoría fuera del
// catálogo: con structured output no puede salirse de la lista, así que no
// hace falta una validación defensiva de categorías aguas abajo (validarTaller
// la repite igualmente, porque el cliente nunca se cree).
const ESQUEMA_TALLERES = {
  type: 'object',
  properties: {
    curso: {
      type: ['string', 'null'],
      description: "Curso escolar al que pertenece el folleto, formato 'YYYY/YYYY'. null si no aparece.",
    },
    talleres: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string', maxLength: LIMITES.nombre },
          categoria: { type: 'string', enum: IDS_CATEGORIAS_TALLER },
          lugar: { type: 'string' },
          precio: { type: 'string' },
          edades: { type: 'string' },
          turnos: {
            type: 'array',
            // Sin `maxItems`: la API rechaza esa palabra en un schema de
            // structured output ("For 'array' type, property 'maxItems' is not
            // supported"). El tope real lo pone validarTaller() en el servidor,
            // que es donde tiene que estar de todas formas.
            items: {
              type: 'object',
              properties: {
                etiqueta: { type: 'string' },
                dias: { type: 'array', items: { type: 'string', enum: IDS_DIAS } },
                horaInicio: { type: 'string' },
                horaFin: { type: 'string' },
                lugar: { type: 'string' },
              },
              required: ['etiqueta', 'dias', 'horaInicio', 'horaFin', 'lugar'],
              additionalProperties: false,
            },
          },
        },
        required: ['nombre', 'categoria', 'lugar', 'precio', 'edades', 'turnos'],
        additionalProperties: false,
      },
    },
  },
  required: ['curso', 'talleres'],
  additionalProperties: false,
}

const INSTRUCCIONES = `Eres un asistente del Ayuntamiento de Navalcarnero. Recibes el folleto de HORARIOS DE TALLERES MUNICIPALES de un curso escolar y extraes su catálogo completo, taller a taller.

Un taller NO es un evento: no ocurre un día concreto, se imparte en TURNOS que se repiten cada semana durante todo el curso. Por eso cada taller lleva una lista de turnos.

Para cada taller:
- nombre: el del folleto, legible y sin mayúsculas gritadas ("Pintura adultos iniciación", no "PINTURA ADULTOS INICIACIÓN"). Si el folleto distingue dos talleres del mismo tipo por nivel o edad ("Pintura adultos iniciación" y "Pintura adultos avanzado"), son DOS talleres, no uno con dos turnos.
- categoria: la de la lista permitida que mejor lo describa.
- lugar: el sitio donde se imparte, sin ", Navalcarnero". Cadena vacía si el folleto no lo dice.
- precio: tal como aparece, con su unidad ("22 €/mes"). Cadena vacía si no consta. NO incluyas aquí la matrícula: es una cuota general del ayuntamiento, no del taller.
- edades: el requisito de edad tal cual ("A partir de 18 años", "De 6 a 15 años"). Cadena vacía si no consta.

Para cada TURNO de un taller:
- etiqueta: lo que distingue ese turno de los otros del mismo taller — la franja de edad ("De 7 a 11 años") o el nivel ("Nivel iniciación"). Cadena VACÍA si el taller tiene varios turnos que solo se diferencian por el horario, sin nombre propio.
- dias: los días de la semana de ese turno, de la lista permitida. Un turno de "martes y jueves" lleva los dos.
- horaInicio / horaFin: formato HH:MM en 24 horas. Cadena vacía si el folleto no concreta el horario ("por determinar").
- lugar: SOLO si ESE turno se imparte en un sitio distinto al del taller. Si coincide con el del taller, cadena VACÍA — no lo repitas.

REGLAS QUE NO PUEDES SALTARTE:
- No inventes ni deduzcas talleres, turnos, días ni horas que no estén escritos en el documento. Si un dato no aparece, cadena vacía o lista vacía.
- Distinto es que el folleto diga EXPLÍCITAMENTE que un dato está pendiente ("Por determinar", "Pendiente de confirmar"): eso es información, no ausencia de dato. Transcribe ese texto tal cual en el campo que corresponda en vez de dejarlo vacío.
- Transcribe los días EXACTAMENTE como los indica el folleto. Dos turnos del mismo taller pueden caer en días distintos (uno el jueves y otro el viernes): no los unifiques ni supongas que comparten día.
- Si un taller aparece sin horario concreto, inclúyelo igualmente con un único turno de días vacíos y horas vacías.
- Extrae TODOS los talleres del documento, sin omitir ninguno.`

/**
 * Extrae el catálogo de talleres de un PDF.
 *
 * @param {Buffer} buffer contenido del PDF
 * @returns {Promise<{curso: string|null, talleres: object[]}>}
 * @throws si la API falla, rechaza la petición o devuelve algo no parseable —
 *         el llamador decide qué contarle al superadmin.
 */
export async function extraerTalleresDePdf(buffer) {
  const client = new Anthropic()

  const respuesta = await client.messages.create({
    model: MODEL,
    max_tokens: 16384,
    system: INSTRUCCIONES,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_TALLERES } },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
          },
          { type: 'text', text: 'Extrae el catálogo completo de talleres de este folleto.' },
        ],
      },
    ],
  })

  if (respuesta.stop_reason === 'refusal') {
    throw new Error('El modelo rechazó la petición.')
  }

  const texto = respuesta.content.find((c) => c.type === 'text')?.text
  if (!texto) throw new Error('El modelo no devolvió contenido.')

  let datos
  try {
    datos = JSON.parse(texto)
  } catch {
    throw new Error('La respuesta del modelo no es JSON válido.')
  }

  return {
    curso: typeof datos.curso === 'string' && datos.curso.trim() ? datos.curso.trim() : null,
    talleres: Array.isArray(datos.talleres) ? datos.talleres : [],
    uso: respuesta.usage,
  }
}
