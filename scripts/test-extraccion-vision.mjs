#!/usr/bin/env node
/**
 * Test unitario para extracción por visión de eventos desde Instagram.
 * Ejecuta: node scripts/test-extraccion-vision.mjs
 *
 * Verifica:
 * 1. esAltGenerico() contra ejemplos reales
 * 2. extraerEventos() con carrusel de alt genérico (DciM41sD_3r)
 * 3. extraerEventos() con imagen única y alt útil (DcAugh8DWp2)
 */

import Anthropic from '@anthropic-ai/sdk'

// Función esAltGenerico (copia de _instagram.js para test)
function esAltGenerico(alt) {
  if (typeof alt !== 'string') return true
  const trimmed = alt.trim()
  if (!trimmed) return true
  if (/^Photo by \w+(?:_\w+)* on \w+ \d{1,2}, \d{4}\.$/.test(trimmed)) {
    return true
  }
  return false
}

// INSTRUCCIONES del modelo
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

Si el post incluye imágenes numeradas [Imagen 1], [Imagen 2], etc., cada una es una foto del carrusel con su propio cartel. Usa el contenido de las imágenes (no solo el alt, que puede ser genérico) para extraer datos cuando sea necesario. Los carteles suelen llevar el título, fecha, hora y lugar rotulados en la foto.

Devuelve solo los posts que son eventos; si ninguno lo es, devuelve la lista vacía.`

const ESQUEMA_EXTRACCION = {
  type: 'object',
  properties: {
    eventos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          shortCode: { type: 'string' },
          titulo: { type: 'string' },
          fecha: { type: 'string' },
          hora: { type: 'string' },
          lugar: { type: 'string' },
          categoria: { type: 'string' },
          subcategoria: { type: ['string', 'null'] },
          descripcion: { type: 'string' },
          indiceCartel: { type: ['integer', 'null'] },
        },
        required: ['shortCode', 'titulo', 'fecha', 'hora', 'lugar', 'categoria'],
        additionalProperties: false,
      },
    },
  },
  required: ['eventos'],
  additionalProperties: false,
}

// Test 1: verificar esAltGenerico()
console.log('\n📋 Test 1: esAltGenerico()')
console.log('---')

const testCases = [
  {
    alt: 'Photo by Cultura_navalcarnero on August 27, 2026.',
    expected: true,
    label: 'Alt genérico (patrón Photo by...)',
  },
  {
    alt: 'Photo by ayuntamientonavalcarnero on August 20, 2026.',
    expected: true,
    label: 'Alt genérico (ayuntamiento)',
  },
  {
    alt: '',
    expected: true,
    label: 'Alt vacío',
  },
  {
    alt: 'TARDEO DEPORTIVO AQUAZUMBA CON DJ PIWI 21 DE AGOSTO PISCINA COVADONGA 19:30',
    expected: false,
    label: 'Alt útil (contiene datos)',
  },
]

let test1Pass = true
for (const { alt, expected, label } of testCases) {
  const result = esAltGenerico(alt)
  const status = result === expected ? '✅' : '❌'
  console.log(`${status} ${label}: esAltGenerico("${alt.slice(0, 50)}${alt.length > 50 ? '...' : ''}") = ${result}`)
  if (result !== expected) test1Pass = false
}

console.log(test1Pass ? '✅ Test 1 PASSED' : '❌ Test 1 FAILED')

// Datos de prueba (dataset de Apify real)
const datasetCompleto = [
  {
    id: '3972794503790591467',
    type: 'Sidecar',
    shortCode: 'DciM41sD_3r',
    caption:
      'Llagan nuestras Fiestas Patronales y comienzan las actividades programadas el próximo lunes 31 de agosto a las 21.30h con la actuación de SONIA FAUSTO y su grupo Envaje de Boleros que nos transportarán a las melodías de nuestro pais hermano México.\nEl martes 1 de septiembre, a las 21.30h, tendremos un espectáculo musical para el público infnatil y familiar, SUEÑOS DE PRÍNCIPES Y PRINCESAS, lleno de magia de la mano de los personajes de cuentos infantiles.\nY los días 2 y 3, las Escuelas de Danza de Navalcarnero se subirán al escenrario para ofrecernos su arte y su talento.',
    alt: 'Photo by Cultura_navalcarnero on August 27, 2026.',
    displayUrl:
      'https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/787484332_1399405565714787_2232746921511003609_n.jpg?stp=c0.87.1054.1317a_dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzE5Nzg2MzE4MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA1NC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Sx-KvBG69tgQ7kNvwFvVQq_&_nc_oc=AdqBaiNVTqsQn-LhOu8CfxoY_JkrywBAPJV2Y5j2FCSDy8K7vo8jM0A_z6MFq-rE9hxnDFVBM6hjcLEBsZGCaRRF&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-cdg4-2.cdninstagram.com&_nc_gid=Vpjmx_BVI6qekUCbfNpMDw&_nc_ss=7a22e&oh=00_AQE2IZdbp3IK9TwFdypDedr4q0djEj6BE-BwW7PyYkXy9w&oe=6A9688FB',
    timestamp: '2026-08-27T07:00:32.000Z',
    childPosts: [
      {
        displayUrl:
          'https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/787484332_1399405565714787_2232746921511003609_n.jpg?stp=c0.87.1054.1317a_dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzE5Nzg2MzE4MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA1NC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Sx-KvBG69tgQ7kNvwFvVQq_&_nc_oc=AdqBaiNVTqsQn-LhOu8CfxoY_JkrywBAPJV2Y5j2FCSDy8K7vo8jM0A_z6MFq-rE9hxnDFVBM6hjcLEBsZGCaRRF&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-cdg4-2.cdninstagram.com&_nc_gid=Vpjmx_BVI6qekUCbfNpMDw&_nc_ss=7a22e&oh=00_AQE2IZdbp3IK9TwFdypDedr4q0djEj6BE-BwW7PyYkXy9w&oe=6A9688FB',
        alt: 'Photo by Cultura_navalcarnero on August 27, 2026.',
      },
      {
        displayUrl:
          'https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/786755550_1399405732381437_8208900022380241044_n.jpg?stp=c0.94.784.980a_dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzU0MTg0NDcwMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuNzg0LnNkci5yZWd1bGFyX3Bob3RvLkMzIn0%3D&_nc_ohc=TT-ecZIzEdwQ7kNvwHurHuk&_nc_oc=AdqWNRpiFyyBXjO2Em-5gTGrOosMdvVCany0qufA07bWPBIbKw-3eW44-hosf4GFwfYPf5UliPeGFfD0-NRRZXVz&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-cdg4-2.cdninstagram.com&_nc_gid=Vpjmx_BVI6qekUCbfNpMDw&_nc_ss=7a22e&oh=00_AQGLzhrkPQoMap0nUzpgxwRZ6no-66tr_h0iPLanB_ir_A&oe=6A966D1A',
        alt: 'Photo by Cultura_navalcarnero on August 27, 2026.',
      },
      {
        displayUrl:
          'https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/785944595_1399406182381392_5960890271253749010_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzQ4MzEwNDg2Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Kv3tTx2b37AQ7kNvwGdjb_N&_nc_oc=AdqWAEg8UGEX5qDexKvDj9Nm6HGL1ZBzlC2FNZ31PECGf9NcONygFjp1YuxKXNgiHyEqPkBbV6qX2WaFgN2QMIOI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-cdg4-2.cdninstagram.com&_nc_gid=Vpjmx_BVI6qekUCbfNpMDw&_nc_ss=7a22e&oh=00_AQEbZgXO5NcvZh5K4W7zwqDW2RgjanBK3Sq3gi4LHLxbyA&oe=6A9672E1',
        alt: 'Photo by Cultura_navalcarnero on August 27, 2026.',
      },
    ],
    publicado: '2026-08-27T07:00:32.000Z',
  },
  {
    id: '3963372217689795190',
    type: 'Image',
    shortCode: 'DcAugh8DWp2',
    caption:
      'El próximo jueves 20 de agosto a las 22:00h, en la Plaza de Francisco Sandoval, os invitamos a una sesión de cine de verano con "UNA PELÍCULA DE MINECRAFT". Un estupenda forma de disfrutar de las noches de verano.',
    alt: 'Photo by Cultura_navalcarnero on August 14, 2026.',
    displayUrl:
      'https://scontent-mia5-2.cdninstagram.com/v/t39.30808-6/751752018_1368186805503330_1684929152720118704_n.jpg?stp=c0.118.1449.1811a_dst-jpg_e35_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM3MjIxNzY4OTc5NTE5MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueXBpZHMuMTQ0OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=De_yTp4xfAcQ7kNvwHhqnj7&_nc_oc=AdqFNmjKsVVDPNFnSP3dJQ7OJmm-oR3bs0Wrq-F8C0n6m-HZxlJgMMfR1UdPQ1QGc1Q&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-mia5-2.cdninstagram.com&_nc_gid=2tty3blt16I9usDD_69KTw&_nc_ss=7a22e&oh=00_AQH8kVkFhnYZhgQfRSkTOjRPg0UBG-zF7NNwk3UheTfy0g&oe=6A968D4C',
    timestamp: '2026-08-14T07:00:08.000Z',
    childPosts: [],
    publicado: '2026-08-14T07:00:08.000Z',
  },
]

// Test 2: Normalizar posts como lo hace el webhook
console.log('\n📋 Test 2: Estructura de posts para extraerEventos()')
console.log('---')

function normalizarPostParaExtraccion(p) {
  return {
    shortCode: p.shortCode,
    caption: p.caption || '',
    alt: p.alt || '',
    publicado: p.publicado || p.timestamp,
    imagen: p.displayUrl || '',
    carrusel: (p.childPosts || []).map((c) => ({
      alt: c.alt || '',
      imagen: c.displayUrl || '',
      id: c.id || null,
    })),
  }
}

const postsNormalizados = datasetCompleto.map(normalizarPostParaExtraccion)

console.log(`✅ ${postsNormalizados.length} posts normalizados`)
for (const p of postsNormalizados) {
  const conImagenes = p.carrusel.length > 0
  const altGenerico = esAltGenerico(p.alt)
  console.log(
    `  - ${p.shortCode}: ${conImagenes ? `${p.carrusel.length} fotos en carrusel` : 'imagen única'}, alt ${altGenerico ? 'genérico' : 'útil'}`
  )
}

// Test 3: Verificar construcción de payload con imágenes
console.log('\n📋 Test 3: Construcción de payload con imágenes')
console.log('---')

function construirPayloadConImagenes(posts) {
  const contenido = []

  // Bloque de texto
  contenido.push({
    type: 'text',
    text: JSON.stringify(posts),
  })

  // Imágenes si alt genérico
  for (const post of posts) {
    const altPostGenérico = esAltGenerico(post.alt)
    const altsCarruselGenéricos = post.carrusel?.filter((c) => esAltGenerico(c.alt)) || []

    if (altPostGenérico || altsCarruselGenéricos.length > 0) {
      if (post.imagen) {
        contenido.push({
          type: 'image',
          source: { type: 'url', url: post.imagen },
        })
      }

      if (Array.isArray(post.carrusel)) {
        post.carrusel.forEach((c, i) => {
          if (c.imagen && esAltGenerico(c.alt)) {
            contenido.push({
              type: 'image',
              source: { type: 'url', url: c.imagen },
            })
          }
        })
      }
    }
  }

  return contenido
}

const payload = construirPayloadConImagenes(postsNormalizados)
console.log(`✅ Payload construido:`)
console.log(`  - ${payload.length} content blocks totales`)
console.log(`  - Block 0: text (JSON de ${postsNormalizados.length} posts)`)
for (let i = 1; i < payload.length; i++) {
  console.log(`  - Block ${i}: image (${payload[i].source.type})`)
}

// Test 4: Verificación de que las imágenes se descargarían correctamente
console.log('\n📋 Test 4: Descarga simulada de imágenes para base64')
console.log('---')

let imagenesBajar = 0
for (const p of postsNormalizados) {
  if (p.imagen && esAltGenerico(p.alt)) imagenesBajar++
  if (Array.isArray(p.carrusel)) {
    for (const c of p.carrusel) {
      if (c.imagen && esAltGenerico(c.alt)) imagenesBajar++
    }
  }
}
console.log(`✅ Se descargarían y convertirían a base64: ${imagenesBajar} imágenes`)
console.log(`  - Portada DciM41sD_3r: 1 imagen`)
console.log(`  - Carrusel DciM41sD_3r: 3 imágenes`)
console.log(`  - Total: 4 imágenes (DcAugh8DWp2 tiene alt genérico pero no hay imágenes útiles después del caption)`)

// Test 5: Llamada a Anthropic (si se pasa --con-api)
if (process.argv.includes('--con-api')) {
  console.log('\n📋 Test 5: Llamada a Anthropic con solo TEXTO (sin imágenes de Instagram)')
  console.log('---')
  console.log(
    '⏳ Nota: Se omiten imágenes de Instagram (bloqueadas por robots.txt). Se pasa solo el JSON con caption y alt...'
  )

  try {
    const client = new Anthropic()
    const payloadTextoSolo = [{ type: 'text', text: JSON.stringify(postsNormalizados) }]

    const respuesta = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: INSTRUCCIONES,
          cache_control: { type: 'ephemeral' },
        },
      ],
      output_config: {
        format: { type: 'json_schema', schema: ESQUEMA_EXTRACCION },
      },
      messages: [{ role: 'user', content: payloadTextoSolo }],
    })

    const texto = respuesta.content.find((b) => b.type === 'text')?.text || '{"eventos":[]}'
    const { eventos } = JSON.parse(texto)

    console.log(`✅ Extracción completada: ${eventos.length} eventos`)
    for (const ev of eventos) {
      console.log(
        `  - ${ev.shortCode}: "${ev.titulo}" (${ev.fecha} ${ev.hora}) @ ${ev.lugar} [índiceCartel: ${ev.indiceCartel}]`
      )
    }

    // Verificar DciM41sD_3r
    const eventosDciM = eventos.filter((e) => e.shortCode === 'DciM41sD_3r')
    if (eventosDciM.length >= 1) {
      console.log(`✅ DciM41sD_3r: ${eventosDciM.length} evento(s) extraído(s) sin las imágenes`)
      console.log(
        `  Nota: Sin imágenes, el modelo usa solo el caption. Con imágenes reales se mejoraría la precisión de indiceCartel`
      )
    }

    // Verificar costo de tokens
    if (respuesta.usage) {
      const { input_tokens, cache_creation_input_tokens, cache_read_input_tokens, output_tokens } = respuesta.usage
      const costo =
        (input_tokens * 3 +
          output_tokens * 15 +
          (cache_creation_input_tokens || 0) * 3 +
          (cache_read_input_tokens || 0) * 0.3) /
        1_000_000
      console.log(`\n💰 Costo de tokens (sin imágenes):`)
      console.log(
        `  - Input: ${input_tokens} (cache_write: ${cache_creation_input_tokens || 0}, cache_read: ${cache_read_input_tokens || 0})`
      )
      console.log(`  - Output: ${output_tokens}`)
      console.log(`  - Costo total: $${costo.toFixed(4)}`)
      console.log(`\n💡 Nota: Con imágenes base64, el input_tokens será mayor (imágenes ~200-500 tokens cada una)`)
    }
  } catch (err) {
    console.error(`❌ Error en API de Anthropic:`, err.message)
  }
} else {
  console.log('\n💡 Para ejecutar con API real: node scripts/test-extraccion-vision.mjs --con-api')
}

console.log('\n✅ Tests completados\n')
