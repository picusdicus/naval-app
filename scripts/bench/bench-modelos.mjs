// Arnés de comparación de modelos (PLAN_MODELOS.md, fase 1).
//
//   npm run bench:modelos -- --feature=eventos --modelos=anthropic/claude-opus-5,anthropic/claude-haiku-4-5 [--ejecuciones=2] [--datasets=a,b]
//
// Por modelo y ejecución corre la extracción de la feature sobre cada dataset
// de scripts/bench/datasets/ (los que tienen <nombre>.verdad.json) y compara
// con esa verdad. Métricas: posts bien clasificados, falsos positivos (lo
// grave: en eventos nacen 'publicado' y entran en el digest), falsos
// negativos, campos exactos (fecha, hora, lugar y título por
// titulosEquivalentes), estabilidad entre ejecuciones, latencia, tokens y
// coste (scripts/bench/precios.json). Tabla en consola y JSON en
// scripts/bench/resultados/<fecha>-<feature>.json.
//
// CERO EFECTOS SECUNDARIOS, garantizado por el entorno y no por promesa:
// antes de importar los handlers se borran del entorno las variables de
// Neon, Blob, correo, Apify y rate-limit (VARIABLES_CON_EFECTOS) y del .env
// solo se cargan las claves de proveedor. Se importan únicamente las
// funciones de extracción exportadas (extraerEventos/extraerNoticias +
// validarExtraccion), nunca procesar() ni los handlers.
//
// Fase 1: solo proveedor `anthropic` (SDK actual). --modelos ya usa el
// formato proveedor/modelo para que la interfaz no cambie en la fase 3.
//
// Nota sobre la antigüedad: el corte de 30 días (esPostReciente) NO se
// aplica — un dataset fijo envejece por definición y se mide entero.
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CLAVES_PROVEEDOR,
  DIR_BENCH,
  DIR_DATASETS,
  DIR_RESULTADOS,
  VARIABLES_CON_EFECTOS,
  argumento,
  cargarEnv,
  leerJson,
  listarDatasets,
  postsDeFichero,
  urlEstable,
} from './_comun.mjs'

// ——— Entorno: primero aislar, después cargar claves, y SOLO ENTONCES importar ———
for (const v of VARIABLES_CON_EFECTOS) delete process.env[v]
cargarEnv(CLAVES_PROVEEDOR)

const args = process.argv.slice(2)
const feature = argumento(args, 'feature')
const modelosArg = argumento(args, 'modelos')
const ejecuciones = Number(argumento(args, 'ejecuciones', 2))
const datasetsArg = argumento(args, 'datasets')

const FEATURES = ['eventos', 'noticias']
if (!FEATURES.includes(feature) || typeof modelosArg !== 'string' || !modelosArg) {
  console.error(
    'Uso: npm run bench:modelos -- --feature=<eventos|noticias> --modelos=<proveedor/modelo,...> [--ejecuciones=2] [--datasets=a,b]'
  )
  process.exit(1)
}

const PROVEEDORES_SOPORTADOS = ['anthropic']
const MAX_INTENTOS = 4
const modelos = modelosArg.split(',').map((m) => m.trim()).filter(Boolean)
for (const m of modelos) {
  const [proveedor, ...resto] = m.split('/')
  if (!PROVEEDORES_SOPORTADOS.includes(proveedor) || !resto.length) {
    console.error(
      `Modelo "${m}": en esta fase solo se admite el formato anthropic/<modelo> (proveedores soportados: ${PROVEEDORES_SOPORTADOS.join(', ')}).`
    )
    process.exit(1)
  }
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Falta ANTHROPIC_API_KEY (en el entorno o en .env).')
  process.exit(1)
}

const { normalizarPost, MAX_POSTS } = await import('../../api/_instagram.js')
const { claveTitulo, titulosEquivalentes } = await import('../../src/lib/dedupEventos.js')

// Cada feature: cómo se llama a la extracción, cómo se proyecta el post
// (la MISMA proyección que hace procesar() en su handler — si cambia allí,
// cambiar aquí) y cómo se lee el resultado.
const FEATURE = {
  eventos: {
    async cargar() {
      const { extraerEventos, validarExtraccion } = await import('../../api/sync-instagram.js')
      return { extraer: extraerEventos, validar: validarExtraccion }
    },
    proyectar: ({ shortCode, caption, alt, publicado, carrusel, imagen, lado }) => ({
      shortCode, caption, alt, publicado, carrusel, imagen, lado,
    }),
    // Un post cuenta como positivo para esta feature si la verdad dice 'evento'.
    esPositivo: (v) => v.esperado === 'evento',
    items: (r) => r.eventos,
    validos: (r) => r.validos,
    firma: (it) => `${it.shortCode}|${it.fecha}|${claveTitulo(it.titulo)}`,
  },
  noticias: {
    async cargar() {
      const { extraerNoticias, validarExtraccion } = await import('../../api/sync-instagram-noticias.js')
      return { extraer: extraerNoticias, validar: validarExtraccion }
    },
    proyectar: ({ shortCode, caption, alt, publicado }) => ({ shortCode, caption, alt, publicado }),
    // El triaje de noticias debe ACEPTAR noticias y actividades y RECHAZAR
    // eventos de agenda (los cubre el otro webhook) y el resto.
    esPositivo: (v) => v.esperado === 'noticia' || v.esperado === 'actividad',
    items: (r) => r.noticias,
    validos: (r) => r.validas,
    firma: (it) => `${it.shortCode}|${it.tipo}|${it.urgente ? 'urgente' : ''}`,
  },
}[feature]

const { extraer, validar } = await FEATURE.cargar()

// ——— Datasets ———
const nombres = typeof datasetsArg === 'string' ? datasetsArg.split(',').map((s) => s.trim()) : listarDatasets()
if (!nombres.length) {
  console.error(`No hay datasets con verdad en ${DIR_DATASETS}. Prepara uno con scripts/bench/preparar-dataset.mjs.`)
  process.exit(1)
}
const ESPERADOS = ['evento', 'actividad', 'noticia', 'nada']
const datasets = nombres.map((nombre) => {
  const crudos = postsDeFichero(join(DIR_DATASETS, `${nombre}.json`))
  const posts = crudos.map(normalizarPost).filter(Boolean).slice(0, MAX_POSTS)
  const verdad = leerJson(join(DIR_DATASETS, `${nombre}.verdad.json`))
  const porShortCode = new Map(posts.map((p) => [p.shortCode, p]))
  const verdadPor = new Map()
  for (const v of verdad) {
    if (!ESPERADOS.includes(v.esperado)) {
      console.error(`${nombre}.verdad.json: ${v.shortCode} tiene esperado="${v.esperado}" (debe ser ${ESPERADOS.join('|')}).`)
      process.exit(1)
    }
    if (!porShortCode.has(v.shortCode)) console.warn(`${nombre}: la verdad cita ${v.shortCode}, que no está en el dataset (o no normaliza).`)
    verdadPor.set(v.shortCode, v)
  }
  for (const p of posts) {
    if (!verdadPor.has(p.shortCode)) {
      console.error(`${nombre}.verdad.json: falta el post ${p.shortCode}.`)
      process.exit(1)
    }
  }
  // Fotos con URL no estable: el modelo no las verá (o verá otra cosa que
  // en producción). Se avisa, no se aborta: el texto sigue midiéndose.
  // URLs únicas: en un carrusel la portada (`imagen`) es también la primera
  // foto de `carrusel`, y contarla dos veces inflaría el aviso.
  const inestables = new Set()
  for (const p of posts) {
    if (p.imagen && !urlEstable(p.imagen)) inestables.add(p.imagen)
    for (const c of p.carrusel || []) if (c.imagen && !urlEstable(c.imagen)) inestables.add(c.imagen)
  }
  return { nombre, posts, verdadPor, fotosInestables: inestables.size }
})

// ——— Precios ———
const precios = leerJson(join(DIR_BENCH, 'precios.json'))
function costeDe(modelo, uso) {
  const p = precios.modelos[modelo]
  if (!p || !uso) return null
  return (
    (uso.entrada / 1e6) * p.entrada +
    (uso.salida / 1e6) * p.salida +
    (uso.cacheEscrito / 1e6) * (p.cacheEscritura ?? p.entrada * 1.25) +
    (uso.cacheLeido / 1e6) * (p.cacheLectura ?? p.entrada * 0.1)
  )
}

// ——— Comparación con la verdad ———
function igualTexto(a, b) {
  return titulosEquivalentes(claveTitulo(a), claveTitulo(b))
}

/** Métricas de UNA ejecución sobre UN dataset. */
function evaluar(dataset, validos) {
  const porPost = new Map()
  for (const it of validos) {
    if (!porPost.has(it.shortCode)) porPost.set(it.shortCode, [])
    porPost.get(it.shortCode).push(it)
  }
  const m = {
    posts: 0,
    ignorados: [],
    aciertos: 0,
    falsosPositivos: [],
    falsosNegativos: [],
    campos: { esperados: 0, emparejados: 0, titulo: 0, fecha: 0, hora: 0, lugar: 0, sobrantes: 0 },
    noticia: { comparados: 0, tipo: 0, urgente: 0, categoria: 0, fechaLimite: 0 },
    porPost: {},
  }
  for (const p of dataset.posts) {
    const v = dataset.verdadPor.get(p.shortCode)
    const extraidos = porPost.get(p.shortCode) || []
    // `ignorar: "<motivo>"` en la verdad: el post viaja al modelo (forma
    // parte del run real) pero no puntúa — típicamente porque el cartel que
    // decide si es evento se perdió al caducar la URL y la verdad no puede
    // fijarse sin verlo. Se quita la marca cuando se recupera la foto.
    if (v.ignorar) {
      m.ignorados.push(p.shortCode)
      m.porPost[p.shortCode] = { esperado: v.esperado, items: extraidos.length, ignorado: true }
      continue
    }
    m.posts++
    const positivo = FEATURE.esPositivo(v)
    const detectado = extraidos.length > 0
    if (positivo === detectado) m.aciertos++
    else if (detectado) m.falsosPositivos.push(p.shortCode)
    else m.falsosNegativos.push(p.shortCode)
    m.porPost[p.shortCode] = { esperado: v.esperado, items: extraidos.length }

    if (!positivo || !detectado) continue

    if (feature === 'eventos') {
      const esperados = Array.isArray(v.eventos) ? v.eventos : []
      m.campos.esperados += esperados.length
      // Emparejar cada evento esperado con uno extraído del mismo post, del
      // más seguro al menos: misma fecha + título equivalente; si no, misma
      // fecha (sin ambigüedad: una sola candidata); si no, título
      // equivalente. El título se PUNTÚA después como un campo más, no es la
      // única llave: en una serie de varios días ("Matinés musical" ×8) la
      // fecha distingue mejor que el título, y un título redactado distinto
      // no debe hacer perder también fecha/hora/lugar.
      const usados = new Set()
      const libres = () => extraidos.map((e, i) => [e, i]).filter(([, i]) => !usados.has(i))
      for (const esp of esperados) {
        const tituloOk = ([e]) => igualTexto(e.titulo, esp.titulo)
        const fechaOk = ([e]) => esp.fecha !== undefined && e.fecha === esp.fecha
        let par = libres().find((c) => fechaOk(c) && tituloOk(c))
        if (!par) {
          const porFecha = libres().filter(fechaOk)
          if (porFecha.length === 1) par = porFecha[0]
        }
        if (!par) par = libres().find(tituloOk)
        if (!par) continue
        const [e, idx] = par
        usados.add(idx)
        m.campos.emparejados++
        if (igualTexto(e.titulo, esp.titulo)) m.campos.titulo++
        if (esp.fecha !== undefined && e.fecha === esp.fecha) m.campos.fecha++
        if (esp.hora !== undefined && (e.hora || null) === (esp.hora || null)) m.campos.hora++
        if (esp.lugar !== undefined && igualTexto(e.lugar, esp.lugar)) m.campos.lugar++
      }
      // Eventos extraídos que no casan con ningún esperado: sobre-extracción
      // (el modo de fallo de Haiku en cdcb163: 12 eventos donde había 2).
      m.campos.sobrantes += extraidos.length - usados.size
      m.porPost[p.shortCode].emparejados = usados.size
    } else {
      const esp = v.noticia || {}
      const e = extraidos[0]
      m.noticia.comparados++
      const tipoEsperado = esp.tipo || v.esperado
      if (e.tipo === tipoEsperado) m.noticia.tipo++
      if (esp.urgente !== undefined && Boolean(e.urgente) === Boolean(esp.urgente)) m.noticia.urgente++
      if (esp.categoria !== undefined && e.categoria === esp.categoria) m.noticia.categoria++
      if (esp.fechaLimite !== undefined && (e.fechaLimite || null) === (esp.fechaLimite || null)) m.noticia.fechaLimite++
      m.porPost[p.shortCode].tipo = e.tipo
    }
  }
  return m
}

function sumar(a, b) {
  const s = JSON.parse(JSON.stringify(a))
  s.posts += b.posts
  s.ignorados = [...s.ignorados, ...b.ignorados]
  s.aciertos += b.aciertos
  s.falsosPositivos = [...s.falsosPositivos, ...b.falsosPositivos]
  s.falsosNegativos = [...s.falsosNegativos, ...b.falsosNegativos]
  for (const k of Object.keys(s.campos)) s.campos[k] += b.campos[k]
  for (const k of Object.keys(s.noticia)) s.noticia[k] += b.noticia[k]
  Object.assign(s.porPost, b.porPost)
  return s
}

const METRICAS_VACIAS = () => ({
  posts: 0, ignorados: [], aciertos: 0, falsosPositivos: [], falsosNegativos: [],
  campos: { esperados: 0, emparejados: 0, titulo: 0, fecha: 0, hora: 0, lugar: 0, sobrantes: 0 },
  noticia: { comparados: 0, tipo: 0, urgente: 0, categoria: 0, fechaLimite: 0 },
  porPost: {},
})

// ——— Ejecución ———
let commit = 'desconocido'
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: DIR_BENCH, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
} catch {}

console.log(`feature=${feature}  modelos=${modelos.join(', ')}  ejecuciones=${ejecuciones}  commit=${commit}`)
for (const d of datasets) {
  console.log(
    `dataset ${d.nombre}: ${d.posts.length} posts` +
      (d.fotosInestables ? `  ⚠ ${d.fotosInestables} fotos con URL no estable (probablemente caducadas: el modelo no las verá)` : '')
  )
}
console.log()

const resultado = {
  feature,
  fecha: new Date().toISOString(),
  commit,
  ejecuciones,
  datasets: datasets.map((d) => ({ nombre: d.nombre, posts: d.posts.length, fotosInestables: d.fotosInestables })),
  precios: { actualizado: precios.actualizado },
  modelos: {},
}

for (const modelo of modelos) {
  const idModelo = modelo.split('/').slice(1).join('/')
  const runs = []
  for (let n = 1; n <= ejecuciones; n++) {
    const run = { ejecucion: n, latenciaMs: 0, uso: { entrada: 0, salida: 0, cacheEscrito: 0, cacheLeido: 0 }, errores: [], postsNoEvaluados: 0, firmas: [], metricas: METRICAS_VACIAS(), porDataset: {} }
    for (const d of datasets) {
      const entrada = d.posts.map(FEATURE.proyectar)
      const mapa = new Map(d.posts.map((p) => [p.shortCode, p]))
      // Un lote que falla por RED (conexión, timeout) o que se reintentó
      // sin imágenes no es una decisión del modelo: puntuarlo sería medir la
      // red. Se repite el dataset entero hasta MAX_INTENTOS; si sigue
      // fallando se puntúa lo que haya y el error queda en el JSON.
      let r
      let intentos = 0
      let t0
      do {
        intentos++
        t0 = Date.now()
        r = await extraer(entrada, { modelo: idModelo })
        const porRed = [...(r.errores || []), ...Object.keys(r.fallosPorCausa || {})].some((e) =>
          /connection error|timed out|fetch failed|ECONN|ENOTFOUND|reintentado SIN imágenes|overloaded|529/i.test(e)
        )
        if (!porRed) break
        console.warn(`   ${d.nombre}: fallo de red en la extracción (intento ${intentos}/${MAX_INTENTOS}): ${(r.errores || []).join('; ') || Object.keys(r.fallosPorCausa || {}).join('; ')}`)
        if (intentos < MAX_INTENTOS) await new Promise((res) => setTimeout(res, 20000 * intentos))
      } while (intentos < MAX_INTENTOS)
      run.latenciaMs += Date.now() - t0
      if (intentos > 1) run.reintentosPorRed = (run.reintentosPorRed || 0) + intentos - 1
      if (intentos === MAX_INTENTOS && (r.errores || []).length) {
        // Agotados los reintentos con fallos de red: la ejecución NO mide al
        // modelo. Se guarda en el JSON pero no entra en tabla ni estabilidad.
        run.invalida = `fallo de red persistente: ${r.errores.join('; ')}`
      }
      const validacion = validar(FEATURE.items(r), mapa)
      const validos = FEATURE.validos(validacion)
      if (r.uso) for (const k of Object.keys(run.uso)) run.uso[k] += r.uso[k] || 0
      run.errores.push(...(r.errores || []).map((e) => `${d.nombre}: ${e}`))
      run.postsNoEvaluados += r.postsNoEvaluados || 0
      const m = evaluar(d, validos)
      run.porDataset[d.nombre] = { ...m, descartadosPorValidacion: (validacion.descartados || validacion.descartadas || []).length }
      run.metricas = sumar(run.metricas, m)
      run.firmas.push(...validos.map(FEATURE.firma))
      // Lo extraído, tal cual, para poder revisar a mano un falso positivo.
      run.porDataset[d.nombre].extraidos = validos.map((it) =>
        feature === 'eventos'
          ? { shortCode: it.shortCode, titulo: it.titulo, fecha: it.fecha, hora: it.hora, lugar: it.lugar, categoria: it.categoria }
          : { shortCode: it.shortCode, tipo: it.tipo, titulo: it.titulo, urgente: it.urgente, categoria: it.categoria, fechaLimite: it.fechaLimite }
      )
    }
    run.firmas.sort()
    run.costeUSD = costeDe(modelo, run.uso)
    runs.push(run)
    const m = run.metricas
    console.log(
      `${modelo}  ejecución ${n}/${ejecuciones}${run.invalida ? ' [INVÁLIDA, no puntúa]' : ''}: ${(run.latenciaMs / 1000).toFixed(1)}s  aciertos ${m.aciertos}/${m.posts}  FP ${m.falsosPositivos.length}  FN ${m.falsosNegativos.length}` +
        `  items ${run.firmas.length}  tokens ${run.uso.entrada}+${run.uso.cacheEscrito}+${run.uso.cacheLeido}/${run.uso.salida}` +
        `  coste ${run.costeUSD == null ? '?' : '$' + run.costeUSD.toFixed(4)}` +
        (run.errores.length ? `  ERRORES ${run.errores.length}` : '')
    )
    if (m.falsosPositivos.length) console.log(`   FP: ${m.falsosPositivos.join(', ')}`)
    if (m.falsosNegativos.length) console.log(`   FN: ${m.falsosNegativos.join(', ')}`)
    if (m.ignorados.length && n === 1) console.log(`   ignorados (no puntúan): ${m.ignorados.join(', ')}`)
    for (const e of run.errores) console.log(`   ! ${e}`)
  }

  // Estabilidad: ¿las ejecuciones (válidas) devuelven exactamente lo mismo?
  const validas = runs.filter((r) => !r.invalida)
  const conjuntos = validas.map((r) => new Set(r.firmas))
  const union = new Set(validas.flatMap((r) => r.firmas))
  const interseccion = [...union].filter((f) => conjuntos.every((c) => c.has(f)))
  const clasificacionCambia = []
  const primera = validas[0]?.metricas.porPost || {}
  for (const sc of Object.keys(primera)) {
    const detectado = validas.map((r) => (r.metricas.porPost[sc]?.items || 0) > 0)
    if (new Set(detectado).size > 1) clasificacionCambia.push(sc)
  }
  const estabilidad = {
    ejecucionesValidas: validas.length,
    identicas: validas.length > 1 && conjuntos.every((c) => c.size === union.size) && interseccion.length === union.size,
    itemsComunes: interseccion.length,
    itemsUnion: union.size,
    jaccard: union.size ? interseccion.length / union.size : 1,
    postsQueCambianDeClasificacion: clasificacionCambia,
  }
  // Items que no están en todas las ejecuciones, con una marca por ejecución
  // (X = presente, . = ausente): distingue un título redactado distinto
  // ("sintrastes"/"sintrastres") de un evento que aparece y desaparece.
  const difieren = [...union]
    .filter((f) => !conjuntos.every((c) => c.has(f)))
    .map((f) => `${conjuntos.map((c) => (c.has(f) ? 'X' : '.')).join('')} ${f}`)
    .sort()
  estabilidad.itemsQueDifieren = difieren
  resultado.modelos[modelo] = { modeloReal: idModelo, ejecuciones: runs, estabilidad }
  console.log(
    `${modelo}  estabilidad (${validas.length}/${runs.length} ejecuciones válidas): ${validas.length < 2 ? 'NO MEDIBLE' : estabilidad.identicas ? 'IDÉNTICAS' : 'DIFIEREN'}  items comunes ${estabilidad.itemsComunes}/${estabilidad.itemsUnion}` +
      (clasificacionCambia.length ? `  posts que cambian: ${clasificacionCambia.join(', ')}` : '')
  )
  for (const f of difieren) console.log(`   ${f}`)
  console.log()
}

// ——— Tabla resumen ———
const filas = []
for (const [modelo, r] of Object.entries(resultado.modelos)) {
  const validas = r.ejecuciones.filter((e) => !e.invalida)
  if (!validas.length) {
    filas.push({ modelo, aciertos: 'sin ejecuciones válidas (red)' })
    continue
  }
  const ms = validas.map((e) => e.metricas)
  const media = (f) => (validas.reduce((s, e) => s + f(e), 0) / validas.length)
  const rango = (f) => {
    const vals = ms.map(f)
    const min = Math.min(...vals), max = Math.max(...vals)
    return min === max ? String(min) : `${min}–${max}`
  }
  const fila = {
    modelo,
    ejecuciones: `${validas.length}/${r.ejecuciones.length}`,
    aciertos: `${rango((m) => m.aciertos)}/${ms[0].posts}`,
    FP: rango((m) => m.falsosPositivos.length),
    FN: rango((m) => m.falsosNegativos.length),
    estable: validas.length < 2 ? '—' : r.estabilidad.identicas ? 'sí' : `no (${(r.estabilidad.jaccard * 100).toFixed(0)} %)`,
    latencia: `${(media((e) => e.latenciaMs) / 1000).toFixed(1)} s`,
    tokens: `${Math.round(media((e) => e.uso.entrada + e.uso.cacheEscrito + e.uso.cacheLeido))} / ${Math.round(media((e) => e.uso.salida))}`,
    'coste/run': validas[0].costeUSD == null ? '?' : `$${media((e) => e.costeUSD).toFixed(4)}`,
  }
  if (feature === 'eventos') {
    const esperados = Math.max(...ms.map((m) => m.campos.esperados))
    fila.campos = `emparejados ${rango((m) => m.campos.emparejados)}/${esperados} · título ${rango((m) => m.campos.titulo)} · fecha ${rango((m) => m.campos.fecha)} · hora ${rango((m) => m.campos.hora)} · lugar ${rango((m) => m.campos.lugar)} · sobrantes ${rango((m) => m.campos.sobrantes)}`
  } else {
    fila.campos = `tipo ${rango((m) => m.noticia.tipo)}/${rango((m) => m.noticia.comparados)} · urgente ${rango((m) => m.noticia.urgente)} · categoría ${rango((m) => m.noticia.categoria)} · plazo ${rango((m) => m.noticia.fechaLimite)}`
  }
  filas.push(fila)
}
console.table(filas)

// Markdown para pegar en PLAN_MODELOS.md.
const cabeceras = Object.keys(filas[0])
console.log(`| ${cabeceras.join(' | ')} |`)
console.log(`| ${cabeceras.map(() => '---').join(' | ')} |`)
for (const f of filas) console.log(`| ${cabeceras.map((c) => f[c]).join(' | ')} |`)

mkdirSync(DIR_RESULTADOS, { recursive: true })
const salida = join(DIR_RESULTADOS, `${resultado.fecha.slice(0, 10)}-${feature}.json`)
writeFileSync(salida, JSON.stringify(resultado, null, 2) + '\n')
console.log(`\nJSON: ${salida}`)
