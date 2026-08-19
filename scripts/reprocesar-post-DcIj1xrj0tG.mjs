#!/usr/bin/env node
/**
 * Reprocesa el post DcIj1xrj0tG (9 carteles de actividades deportivas)
 * con el nuevo schema que incluye fechaEvento.
 *
 * Extrae nuevas fechas y hace upsert directo en la BD sin filtro de 30 días.
 */
import Anthropic from '@anthropic-ai/sdk'
import { obtenerSql } from '../api/_db.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

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
        required: ['indice', 'titulo', 'categoria', 'fechaEvento', 'fechaLimite', 'horario', 'lugar', 'descripcion'],
        properties: {
          indice: { type: 'integer' },
          titulo: { type: 'string' },
          categoria: { enum: [...CATEGORIAS_ACTIVIDAD, ''] },
          fechaEvento: { type: 'string' },
          fechaLimite: { type: 'string' },
          horario: { type: 'string' },
          lugar: { type: 'string' },
          descripcion: { type: 'string' },
        },
      },
    },
  },
}

// Los 9 carteles del post DcIj1xrj0tG
const carteles = [
  {
    indice: 0,
    alt: 'VIERNES, 21 DE AGOSTO - TARDEO DEPORTIVO AQUAZUMBA Y BAÑO CON DJ PIWI',
  },
  {
    indice: 1,
    alt: 'NATACIÓN - VIERNES 21 A LAS 12:30 EN LA PISCINA',
  },
  {
    indice: 2,
    alt: 'VOLEIBOL - 22 AGOSTO - PABELLÓN MUNICIPAL',
  },
  {
    indice: 3,
    alt: 'TORNEO DE TENIS - 27 DE AGOSTO - PISTAS DE TENIS MUNICIPALES',
  },
  {
    indice: 4,
    alt: 'TORNEO DE FÚTBOL - 27 AGOSTO - INSCRIPCIONES ABIERTAS',
  },
  {
    indice: 5,
    alt: 'AJEDREZ - 5 SEPTIEMBRE - COMPETICIÓN MUNICIPAL',
  },
  {
    indice: 6,
    alt: 'CALISTENIA - 2 SEPTIEMBRE - PARQUE CENTRAL',
  },
  {
    indice: 7,
    alt: 'CARRERA CANINA - GALGOS EN ACCIÓN - DOMINGO A LAS 10:00',
  },
  {
    indice: 8,
    alt: 'PUERTAS ABIERTAS PATINAJE - PRÓXIMAS FECHAS',
  },
]

const instrucciones = `Vas a ver los carteles de un post municipal de Instagram de Navalcarnero. Decide cuáles anuncian una ACTIVIDAD: algo a lo que puede APUNTARSE o en lo que puede PARTICIPAR — torneos, carreras, marchas, cursos, talleres, campamentos, pruebas deportivas (aunque la inscripción sea el mismo día de la prueba).

Devuelve titulo="" para descartar un cartel que no sea una actividad: portadas genéricas, actos a los que solo se asiste como público (conciertos, proyecciones), avisos sin actividad concreta.

Para cada cartel devuelve:
- indice: el N del cartel, copiado tal cual.
- titulo: el nombre de la actividad, corto y legible (sin mayúsculas gritadas).
- categoria: la más apropiada de la lista permitida ("deporte" para pruebas deportivas); "" si se descarta.
- fechaEvento: YYYY-MM-DD de cuándo se celebra la actividad — cuándo ocurre, cuándo es la prueba. Puede estar en el caption o en el alt del cartel. El post se publicó el 2026-08-19: resuelve fechas sin año con ese ancla. "" si no hay fecha clara. Usa SOLO fechas del cartel — no inventes.
- fechaLimite: YYYY-MM-DD del fin del plazo de inscripción si el cartel lo indica explícitamente ("inscripciones hasta", "plazo", "hasta el X"). Si la prueba es de un día, puede coincidir con fechaEvento. "" si no hay plazo. Usa SOLO fechas del cartel — no inventes.
- horario: el horario del cartel (p. ej. "a partir de las 10.00h"); "" si no consta.
- lugar: la instalación o ubicación del cartel; "" si no consta.
- descripcion: los datos prácticos restantes del cartel en una o dos frases legibles, máximo 500 caracteres; "" si no hay más datos.`

async function reprocesar() {
  const sql = obtenerSql()
  const client = new Anthropic()

  console.log('=== REPROCESAR POST DcIj1xrj0tG ===\n')
  console.log(`Extrayendo 9 carteles con nuevo schema (fechaEvento)...\n`)

  try {
    // Construir contenido para Claude
    const contenido = []
    carteles.forEach((c) => {
      contenido.push({
        type: 'text',
        text: `Cartel ${c.indice}${c.alt ? ` — ${c.alt}` : ''}`,
      })
    })
    contenido.push({ type: 'text', text: 'Extrae las actividades de estos carteles.' })

    // Llamar a Claude
    const respuesta = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: instrucciones,
      messages: [{ role: 'user', content: contenido }],
    })

    let texto = respuesta.content.find((b) => b.type === 'text')?.text || '{}'
    // Limpiar markdown code blocks
    texto = texto
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim()

    // Extraer solo el JSON válido (puede haber texto después)
    let resultado
    try {
      // Intentar parsear el texto completo
      resultado = JSON.parse(texto)
    } catch {
      // Si falla, intentar extraer el JSON del texto
      const jsonMatch = texto.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          resultado = JSON.parse(jsonMatch[1])
        } catch (parseErr) {
          console.error('Parse error:', parseErr.message)
          console.error('JSON extraído (primeros 300 chars):', jsonMatch[1].slice(0, 300))
          throw parseErr
        }
      } else {
        throw new Error('No se encontró JSON válido en la respuesta')
      }
    }

    // Claude puede devolver array directo o {actividades: [...]}
    const actividades = Array.isArray(resultado) ? resultado : resultado.actividades || []
    console.log(`Claude extrajo: ${actividades.length} items\n`)
    console.log('Antes de filtrado:')
    actividades.forEach((a, i) => {
      console.log(`  ${i}: indice=${a.indice}, titulo="${a.titulo}", fechaEvento="${a.fechaEvento}"`)
    })
    console.log()

    // Validación y transformación (igual que extraerDeCarrusel)
    const validadas = actividades
      .map((a) => ({
        ...a,
        indice: Number.isInteger(a.indice) ? a.indice : parseInt(a.indice, 10),
      }))
      .filter(
        (a) =>
          Number.isInteger(a.indice) &&
          a.indice >= 0 &&
          a.indice < carteles.length &&
          typeof a.titulo === 'string' &&
          a.titulo.trim()
      )
      .map((a) => ({
        indice: a.indice,
        titulo: a.titulo.trim().slice(0, 200),
        categoria: CATEGORIAS_ACTIVIDAD.includes(a.categoria) ? a.categoria : 'general',
        fechaEvento: /^\d{4}-\d{2}-\d{2}$/.test(a.fechaEvento) ? a.fechaEvento : null,
        fechaLimite: /^\d{4}-\d{2}-\d{2}$/.test(a.fechaLimite) ? a.fechaLimite : null,
        horario: String(a.horario || '').trim().slice(0, 120) || null,
        lugar: String(a.lugar || '').trim().slice(0, 120) || null,
        descripcion: String(a.descripcion || '').trim().slice(0, 600) || null,
      }))
      // Validación: if both dates exist, fechaLimite <= fechaEvento
      .filter((a) => {
        if (a.fechaEvento && a.fechaLimite && a.fechaLimite > a.fechaEvento) {
          console.warn(
            `⚠️  "${a.titulo}": fechaLimite (${a.fechaLimite}) > fechaEvento (${a.fechaEvento}), descartando fechaLimite`
          )
          a.fechaLimite = null
        }
        return true
      })

    console.log(`Después de validación: ${validadas.length} actividades\n`)
    console.log('=== RESULTADOS DETALLADOS ===\n')

    let conFechaEvento = 0
    for (const a of validadas) {
      console.log(`${a.indice}. ${a.titulo}`)
      console.log(`   fechaEvento: ${a.fechaEvento || 'NULL'}`)
      console.log(`   fechaLimite: ${a.fechaLimite || 'NULL'}`)
      console.log()
      if (a.fechaEvento) conFechaEvento++
    }

    console.log(`=== RESUMEN ===`)
    console.log(`Extraídas: ${validadas.length}`)
    console.log(`Con fechaEvento: ${conFechaEvento}/${validadas.length}`)

    // Hacer upsert en la BD
    console.log(`\n=== UPSERTING EN BD ===\n`)
    const publicado = new Date('2026-08-19T12:00:00Z').toISOString()
    const url = 'https://instagram.com/p/DcIj1xrj0tG'

    let actualizadas = 0
    for (const a of validadas) {
      try {
        const resultado = await sql`
          INSERT INTO actividades
            (origen_externo_id, titulo, descripcion, categoria, fecha_evento, fecha_limite, horario,
             lugar, imagen_url, imagen_origen_id, url_fuente, estado, publicado_en)
          VALUES
            (${'ig-' + carteles[a.indice].alt.slice(0, 20).replace(/[^a-z0-9]/gi, '').substring(0, 10)},
             ${a.titulo}, ${a.descripcion}, ${a.categoria},
             ${a.fechaEvento}, ${a.fechaLimite}, ${a.horario}, ${a.lugar}, NULL,
             NULL, ${url}, 'publicado', ${publicado})
          ON CONFLICT (origen_externo_id)
          DO UPDATE SET
            titulo = EXCLUDED.titulo,
            descripcion = EXCLUDED.descripcion,
            categoria = EXCLUDED.categoria,
            fecha_evento = EXCLUDED.fecha_evento,
            fecha_limite = EXCLUDED.fecha_limite,
            horario = EXCLUDED.horario,
            lugar = EXCLUDED.lugar,
            imagen_url = COALESCE(EXCLUDED.imagen_url, actividades.imagen_url),
            imagen_origen_id = COALESCE(EXCLUDED.imagen_origen_id, actividades.imagen_origen_id),
            url_fuente = EXCLUDED.url_fuente,
            actualizado_en = now()
          RETURNING (xmax = 0) AS insertada
        `
        if (resultado[0]?.insertada) {
          console.log(`✓ INSERT ${a.titulo}`)
        } else {
          console.log(`✓ UPDATE ${a.titulo} (con fechaEvento = ${a.fechaEvento})`)
          actualizadas++
        }
      } catch (err) {
        console.error(`✗ ${a.titulo}: ${err.message}`)
      }
    }

    console.log(`\n=== RESULTADO FINAL ===`)
    console.log(`Actualizadas: ${actualizadas}/${validadas.length}`)
    console.log(`✓ Post DcIj1xrj0tG reprocesado`)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

reprocesar()
