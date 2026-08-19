#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk'

// Simulamos 9 carteles de Instagram (como salen de extraerDeCarrusel)
// Estos son ejemplos reales de las actividades deportivas municipales
const carteles = [
  {
    indice: 0,
    alt: 'VIERNES, 21 DE AGOSTO - TARDEO DEPORTIVO AQUAZUMBA Y BAÑO CON DJ PIWI',
    imagen: 'https://cdn.instagram.com/...',
  },
  {
    indice: 1,
    alt: 'NATACIÓN - VIERNES 21 A LAS 12:30 EN LA PISCINA',
    imagen: 'https://cdn.instagram.com/...',
  },
  {
    indice: 2,
    alt: 'VOLEIBOL - 22 AGOSTO - PABELLÓN MUNICIPAL',
    imagen: 'https://cdn.instagram.com/...',
  },
  {
    indice: 3,
    alt: 'TORNEO DE TENIS - 27 DE AGOSTO - PISTAS DE TENIS MUNICIPALES',
    imagen: 'https://cdn.instagram.com/...',
  },
  {
    indice: 4,
    alt: 'TORNEO DE FÚTBOL - 27 AGOSTO - INSCRIPCIONES ABIERTAS',
    imagen: 'https://cdn.instagram.com/...',
  },
  {
    indice: 5,
    alt: 'AJEDREZ - 5 SEPTIEMBRE - COMPETICIÓN MUNICIPAL',
    imagen: 'https://cdn.instagram.com/...',
  },
  {
    indice: 6,
    alt: 'CALISTENIA - 2 SEPTIEMBRE - PARQUE CENTRAL',
    imagen: 'https://cdn.instagram.com/...',
  },
  {
    indice: 7,
    alt: 'CARRERA CANINA - GALGOS EN ACCIÓN - DOMINGO A LAS 10:00',
    imagen: 'https://cdn.instagram.com/...',
  },
  {
    indice: 8,
    alt: 'PUERTAS ABIERTAS PATINAJE - PRÓXIMAS FECHAS',
    imagen: 'https://cdn.instagram.com/...',
  },
]

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

const TIPOS_ALERTA = ['incendio', 'corte_agua', 'corte_luz', 'trafico', 'emergencia', 'general']

// Schema actualizado para CARRUSEL (incluye fechaEvento)
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

const INSTRUCCIONES = `Vas a ver los carteles de un post municipal de Instagram de Navalcarnero, cada uno precedido de una línea "Cartel N" (y, si existe, el texto alternativo generado por Instagram como apoyo — la imagen manda si difieren). Decide cuáles anuncian una ACTIVIDAD para el vecino: algo a lo que puede APUNTARSE o en lo que puede PARTICIPAR — torneos, carreras, marchas, cursos, talleres, campamentos, pruebas deportivas (aunque la inscripción sea el mismo día de la prueba).

Devuelve titulo="" para descartar un cartel que no sea una actividad: portadas genéricas ("PROGRAMACIÓN DEPORTIVA EN AGOSTO"), actos a los que solo se asiste como público (conciertos, proyecciones), avisos y carteles sin actividad concreta.

Para cada cartel devuelve:
- indice: el N de su línea "Cartel N", copiado tal cual.
- titulo: el nombre de la actividad, corto y legible (sin mayúsculas gritadas).
- categoria: la más apropiada de la lista permitida ("deporte" para pruebas deportivas); "" si se descarta.
- fechaEvento: YYYY-MM-DD de cuándo se celebra la actividad — cuándo ocurre, cuándo es la prueba. Puede estar en el caption ("VIERNES, 21 DE AGOSTO") o en el alt del cartel. Resuelve fechas sin año con el post de hoy (2026-08-19). "" si no hay fecha clara. Usa SOLO fechas del cartel — no inventes.
- fechaLimite: YYYY-MM-DD del fin del plazo de inscripción si el cartel lo indica explícitamente ("inscripciones hasta", "plazo", "hasta el X"). Si la prueba es de un día, puede coincidir con fechaEvento. "" si no hay plazo. Usa SOLO fechas del cartel — no inventes.
- horario: el horario del cartel (p. ej. "a partir de las 10.00h"); "" si no consta.
- lugar: la instalación o ubicación del cartel; "" si no consta.
- descripcion: los datos prácticos restantes del cartel en una o dos frases legibles (categorías/edades, condiciones, precio, cómo inscribirse, teléfono de información), máximo 500 caracteres; "" si no hay más datos.`

async function testPost() {
  const client = new Anthropic()

  console.log('=== TEST: 9 CARTELES DE INSTAGRAM (EXTRAERDECARRUSEL) ===\n')
  console.log('Simulando extracción de actividades con fechaEvento nuevo...\n')

  try {
    // Simular el contenido que va a Claude (carteles con alt)
    const contenido = []
    carteles.forEach((c) => {
      contenido.push({
        type: 'text',
        text: `Cartel ${c.indice}${c.alt ? ` — texto alternativo: ${c.alt}` : ''}`,
      })
    })
    contenido.push({ type: 'text', text: 'Extrae las actividades de estos carteles.' })

    const respuesta = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      system: INSTRUCCIONES,
      messages: [{ role: 'user', content: contenido }],
    })

    let texto = respuesta.content.find((b) => b.type === 'text')?.text || '{}'
    // Claude puede envolver en ```json ``` si no se usa structured output
    texto = texto.replace(/^```json\n/, '').replace(/\n```$/, '')
    const resultado = JSON.parse(texto)

    const actividades = resultado.actividades || []

    if (actividades && actividades.length > 0) {
      console.log('=== RESULTADOS DE EXTRACCIÓN ===\n')

      let conFechaEvento = 0
      let conFechaLimite = 0
      let sinFechas = 0

      actividades.forEach((item, i) => {
        const tieneEvento = item.fechaEvento ? '✓' : '❌'
        const tieneLimite = item.fechaLimite ? '✓' : '❌'
        console.log(`${i + 1}. ${item.titulo}`)
        console.log(`   Fecha evento: ${tieneEvento} ${item.fechaEvento || 'NO EXTRAÍDA'}`)
        console.log(`   Plazo inscripción: ${tieneLimite} ${item.fechaLimite || 'NO EXTRAÍDA'}`)
        console.log()

        if (item.fechaEvento) conFechaEvento++
        if (item.fechaLimite) conFechaLimite++
        if (!item.fechaEvento && !item.fechaLimite) sinFechas++
      })

      console.log(`\n=== ANÁLISIS ===`)
      console.log(`Total actividades extraídas: ${actividades.length}`)
      console.log(`Con fecha_evento: ${conFechaEvento}/${actividades.length} (${Math.round((conFechaEvento / actividades.length) * 100)}%)`)
      console.log(`Con fecha_limite: ${conFechaLimite}/${actividades.length} (${Math.round((conFechaLimite / actividades.length) * 100)}%)`)
      console.log(`Sin ninguna fecha: ${sinFechas}/${actividades.length}`)

      if (conFechaEvento > 0) {
        console.log(`\n✓ ÉXITO: Claude extrajo ${conFechaEvento} fecha(s) de EVENTO del alt`)
        console.log(`  Las actividades ahora tienen fecha de celebración`)
      } else {
        console.log(`\n⚠️  FALLO: Claude NO extrajo ninguna fecha de evento`)
        console.log(`  Las actividades quedan sin fecha de celebración`)
      }
    } else {
      console.log('⚠️  TODOS LOS CARTELES DESCARTADOS (ninguno se clasificó como actividad)')
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

testPost()
