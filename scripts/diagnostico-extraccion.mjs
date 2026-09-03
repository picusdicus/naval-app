// Diagnóstico de la extracción de eventos de Instagram, SIN gastar cuota de
// Apify y SIN tocar la base de datos ni Vercel Blob.
//
//   node scripts/diagnostico-extraccion.mjs <dataset.json> [--repeticiones=3]
//
// El dataset es el JSON de un run de Apify ya ejecutado (el que se ve en la
// pestaña Storage de la task, o el cuerpo que el webhook recibió). Se reutiliza
// tantas veces como haga falta: lo único que se gasta son tokens de Anthropic.
//
// Reproduce exactamente lo que hace api/sync-instagram.js hasta la validación
// —normalizarPost, el corte por antigüedad, extraerEventos (con visión y con
// las imágenes reales del CDN) y validarExtraccion— y se para justo antes del
// upsert. Sirve para responder a dos preguntas que el log no distingue bien:
//
//   1. ¿Se cae algún lote de extracción (truncado, refusal, error de API)?
//   2. ¿Es estable la extracción entre ejecuciones con los mismos posts?
//
// Por eso admite --repeticiones: la variabilidad entre runs SOLO se ve
// repitiendo con la misma entrada.
//
// IMPORTANTE: carga el .env entero antes de importar el handler, ANTHROPIC_MODEL
// incluido. Verificar con un modelo distinto del de producción es lo que dejó
// pasar el bug del año en la visión de deportes (31-ago-2026).
import { readFileSync } from 'node:fs'

for (const f of ['.env.local', '.env']) {
  try {
    for (const linea of readFileSync(f, 'utf8').split('\n')) {
      const m = linea.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}

const args = process.argv.slice(2)
const ruta = args.find((a) => !a.startsWith('--'))
const repeticiones = Number(args.find((a) => a.startsWith('--repeticiones='))?.split('=')[1] || 1)

if (!ruta) {
  console.error('Uso: node scripts/diagnostico-extraccion.mjs <dataset.json> [--repeticiones=N]')
  process.exit(1)
}

// Import dinámico: MODEL se fija al cargar el módulo, así que el .env ya debe estar puesto.
const { extraerEventos, validarExtraccion } = await import('../api/sync-instagram.js')
const { normalizarPost, esPostReciente, esAltGenerico, MAX_POSTS } = await import('../api/_instagram.js')

const crudos = JSON.parse(readFileSync(ruta, 'utf8'))
const lista = Array.isArray(crudos) ? crudos : crudos.posts || crudos.items || []
const normalizados = lista.map(normalizarPost).filter(Boolean)
const posts = normalizados.filter((p) => esPostReciente(p)).slice(0, MAX_POSTS)

console.log('Modelo            :', process.env.ANTHROPIC_MODEL || '(por defecto del handler)')
console.log('Posts en el fichero:', lista.length)
console.log('Tras normalizar   :', normalizados.length)
console.log('Tras el corte de 30 días:', posts.length)

const conVision = posts.filter(
  (p) => esAltGenerico(p.alt) || (p.carrusel || []).some((c) => c.imagen && esAltGenerico(c.alt))
)
const imagenes = conVision.reduce(
  (n, p) => n + (p.imagen ? 1 : 0) + (p.carrusel || []).filter((c) => c.imagen && esAltGenerico(c.alt)).length,
  0
)
console.log(`Con visión        : ${conVision.length} posts, ${imagenes} imágenes en total`)
console.log('Repeticiones      :', repeticiones)
console.log()

const entrada = posts.map(({ shortCode, caption, alt, publicado, carrusel }) => ({
  shortCode,
  caption,
  alt,
  publicado,
  carrusel,
}))
const mapa = new Map(posts.map((p) => [p.shortCode, p]))
const porPost = new Map(posts.map((p) => [p.shortCode, []]))

for (let i = 1; i <= repeticiones; i++) {
  const t0 = Date.now()
  const { eventos, errores, postsNoEvaluados, fallosPorCausa } = await extraerEventos(entrada)
  const { validos, descartados } = validarExtraccion(eventos, mapa)
  const segs = ((Date.now() - t0) / 1000).toFixed(1)

  console.log(`--- ejecución ${i}/${repeticiones} (${segs}s) ---`)
  console.log(`extraídos=${eventos.length}  válidos=${validos.length}  descartados=${descartados.length}  posts no evaluados=${postsNoEvaluados}`)
  if (errores.length) {
    console.log('ERRORES DE LOTE:')
    errores.forEach((e) => console.log('   ', e))
    console.log('   por causa:', JSON.stringify(fallosPorCausa))
  }
  const cuenta = {}
  for (const v of validos) cuenta[v.shortCode] = (cuenta[v.shortCode] || 0) + 1
  // Una entrada por EJECUCIÓN en la que el post dio al menos un evento: lo que
  // interesa aquí es la estabilidad del post, no cuántos eventos rinde.
  for (const [sc, n] of Object.entries(cuenta)) {
    porPost.get(sc)?.push({ eventos: n, titulo: validos.find((v) => v.shortCode === sc)?.titulo })
  }
  console.log('   eventos por post:', JSON.stringify(cuenta))
  console.log()
}

console.log('=== estabilidad por post a lo largo de las', repeticiones, 'ejecuciones ===')
for (const p of posts) {
  const rondas = porPost.get(p.shortCode) || []
  const veces = rondas.length
  const marca = veces === 0 ? 'NUNCA  ' : veces === repeticiones ? 'siempre' : 'A VECES'
  const nEventos = [...new Set(rondas.map((r) => r.eventos))].join('/')
  console.log(
    `${marca} ${String(veces).padStart(2)}/${repeticiones} runs` +
      `${nEventos ? `, ${nEventos} ev.` : ''}  ${p.shortCode}  ${rondas[0]?.titulo ? `"${rondas[0].titulo}"` : '(sin evento)'}`
  )
}
