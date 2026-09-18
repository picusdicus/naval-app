// Convierte el JSON de un run de Apify en un dataset FIJO del arnés de
// comparación (PLAN_MODELOS.md, fase 1): el mismo JSON tal cual llega al
// webhook, pero con las URLs de imagen del CDN de Instagram —que caducan a
// los ~4 días— sustituidas por URLs estables.
//
//   node scripts/bench/preparar-dataset.mjs <run-apify.json> --nombre=2026-09-16-ayuntamiento [--dry-run] [--max-puts=60]
//
// Resolución de cada foto, en este orden:
//   1. Ya está en Vercel Blob (la subieron los webhooks: instagram/<sc>.jpg,
//      instagram/<sc>-c<i>.jpg, instagram-noticias/<sc>[-<n>].jpg,
//      instagram-actividades/<sc>[-c<i>].jpg). Se comprueba con un GET a la
//      URL pública, que NO es un Advanced Request de Blob (solo put/list/
//      del/head lo son — y por eso no se usa head()).
//   2. Si no está y la URL del CDN sigue viva, se descarga UNA vez y se sube
//      a bench/<nombre>/<sc>-<i>.<ext> con put() — cada put es un Advanced
//      Request (cuota: 2 000/mes). --dry-run cuenta sin subir; --max-puts
//      aborta antes de empezar si harían falta más.
//   3. Si tampoco está viva, la foto se da por PERDIDA: se conserva la URL
//      original (muerta) y queda anotada en <nombre>.imagenes.json. El bench
//      avisa de las fotos perdidas, porque sin ellas el run no reproduce lo
//      que vio el modelo en producción.
//
// Escribe scripts/bench/datasets/<nombre>.json, <nombre>.imagenes.json (el
// informe) y, si no existe, el esqueleto de <nombre>.verdad.json para
// rellenar a mano.
//
// Es la ÚNICA pieza del arnés que toca Blob. Lee BLOB_READ_WRITE_TOKEN del
// .env; no carga DATABASE_URL ni nada más.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DIR_DATASETS, argumento, cargarEnv, postsDeFichero, urlEstable } from './_comun.mjs'

const BLOB_PUBLICO = 'https://olx4z1ni9hm5hpsn.public.blob.vercel-storage.com/'
const TIMEOUT_MS = 15000
const TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

const args = process.argv.slice(2)
const rutaEntrada = args.find((a) => !a.startsWith('--'))
const nombre = argumento(args, 'nombre')
const dryRun = argumento(args, 'dry-run', false) === true
const maxPuts = Number(argumento(args, 'max-puts', 60))

if (!rutaEntrada || typeof nombre !== 'string' || !/^[a-z0-9-]+$/.test(nombre)) {
  console.error('Uso: node scripts/bench/preparar-dataset.mjs <run-apify.json> --nombre=<aaaa-mm-dd-cuenta> [--dry-run] [--max-puts=N]')
  process.exit(1)
}

cargarEnv(['BLOB_READ_WRITE_TOKEN'])

const posts = postsDeFichero(rutaEntrada)
console.log(`Posts en el fichero: ${posts.length}`)

/** URLs de las fotos de un post, en orden de carrusel (índice 0 = portada). */
function fotosDe(post) {
  if (Array.isArray(post.childPosts) && post.childPosts.length) {
    return post.childPosts.map((c) => c?.displayUrl || '')
  }
  return [post.displayUrl || post.imageUrl || post.thumbnailUrl || post.image || '']
}

function candidatosBlob(shortCode, i) {
  return i === 0
    ? [
        `instagram/${shortCode}.jpg`,
        `instagram/${shortCode}-c0.jpg`,
        `instagram-noticias/${shortCode}.jpg`,
        `instagram-actividades/${shortCode}.jpg`,
        `instagram-actividades/${shortCode}-c0.jpg`,
      ]
    : [
        `instagram/${shortCode}-c${i}.jpg`,
        `instagram-noticias/${shortCode}-${i}.jpg`,
        `instagram-actividades/${shortCode}-c${i}.jpg`,
      ]
}

// Un fallo de RED (DNS, timeout de conexión) no es un 404: se reintenta
// antes de dar una foto por inexistente o perdida — un dataset preparado
// durante un bache de red marcaría como perdidas fotos que están en Blob.
const REINTENTOS = 3
async function fetchConReintentos(url, opciones = {}) {
  let ultimo
  for (let i = 1; i <= REINTENTOS; i++) {
    try {
      return await fetch(url, { ...opciones, signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (err) {
      ultimo = err
      await new Promise((r) => setTimeout(r, 2000 * i))
    }
  }
  throw ultimo
}

/** GET a la URL pública (no cuenta como Advanced Request). true si existe.
 *  Lanza si la red falla las REINTENTOS veces: el llamador decide. */
async function existeEnBlob(url) {
  const r = await fetchConReintentos(url)
  // Consumir el cuerpo para no dejar la conexión colgando.
  await r.arrayBuffer()
  return r.ok
}

async function descargar(url) {
  const r = await fetchConReintentos(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const tipo = (r.headers.get('content-type') || '').split(';')[0].trim()
  if (!TIPOS[tipo]) throw new Error(`tipo no admitido: ${tipo || 'desconocido'}`)
  return { tipo, datos: Buffer.from(await r.arrayBuffer()) }
}

// Pasada 1: qué hay en Blob y qué sigue vivo en el CDN.
const detalle = []
for (const post of posts) {
  const sc = post.shortCode
  const fotos = fotosDe(post)
  for (let i = 0; i < fotos.length; i++) {
    const original = fotos[i]
    const fila = { shortCode: sc, indice: i, original, estado: null, url: null }
    detalle.push(fila)
    if (!original) {
      fila.estado = 'sin-url'
      continue
    }
    if (urlEstable(original)) {
      fila.estado = 'ya-estable'
      fila.url = original
      continue
    }
    for (const c of candidatosBlob(sc, i)) {
      let existe
      try {
        existe = await existeEnBlob(BLOB_PUBLICO + c)
      } catch (err) {
        console.error(`\nRed caída comprobando ${c} (${err.message}): abortando para no dar fotos por perdidas.`)
        process.exit(3)
      }
      if (existe) {
        fila.estado = 'blob-existente'
        fila.url = BLOB_PUBLICO + c
        break
      }
    }
    if (fila.estado) continue
    fila.estado = 'pendiente-subida'
  }
  process.stdout.write('.')
}
console.log()

const pendientes = detalle.filter((f) => f.estado === 'pendiente-subida')
console.log(`Fotos: ${detalle.length} · en Blob: ${detalle.filter((f) => f.estado === 'blob-existente').length} · ya estables: ${detalle.filter((f) => f.estado === 'ya-estable').length} · por subir: ${pendientes.length}`)

// Pasada 2: subir las que falten (o solo contar en --dry-run).
if (pendientes.length && !dryRun) {
  if (pendientes.length > maxPuts) {
    console.error(`Harían falta ${pendientes.length} put() y el tope es ${maxPuts} (--max-puts). No se sube nada.`)
    process.exit(2)
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Falta BLOB_READ_WRITE_TOKEN en .env: no se puede subir a Blob.')
    process.exit(2)
  }
  const { put } = await import('@vercel/blob')
  let subidas = 0
  for (const f of pendientes) {
    try {
      const { tipo, datos } = await descargar(f.original)
      const ruta = `bench/${nombre}/${f.shortCode}-${f.indice}.${TIPOS[tipo]}`
      const { url } = await put(ruta, datos, {
        access: 'public',
        contentType: tipo,
        addRandomSuffix: false,
        allowOverwrite: true,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      f.estado = 'subida'
      f.url = url
      subidas++
      process.stdout.write('+')
    } catch (err) {
      // El CDN de Instagram devuelve 403 cuando la firma ha caducado.
      f.estado = 'perdida'
      f.motivo = err.message
      process.stdout.write('x')
    }
  }
  console.log(`\nput() ejecutados: ${subidas} · perdidas: ${pendientes.filter((f) => f.estado === 'perdida').length}`)
} else if (pendientes.length) {
  // Sin subir, comprobar al menos si el CDN las daría (para saber si merece
  // la pena repetir sin --dry-run o si ya están perdidas).
  let vivas = 0
  for (const f of pendientes) {
    try {
      const r = await fetchConReintentos(f.original)
      await r.arrayBuffer()
      if (r.ok) vivas++
      else f.motivo = `HTTP ${r.status}`
    } catch (err) {
      f.motivo = err.message
    }
  }
  console.log(`--dry-run: ${vivas} de ${pendientes.length} siguen vivas en el CDN (se subirían con ${vivas} put()); ${pendientes.length - vivas} ya están perdidas.`)
}

// Reescribir el dataset con las URLs estables, sin tocar ningún otro campo.
const porClave = new Map(detalle.map((f) => [`${f.shortCode}|${f.indice}`, f]))
for (const post of posts) {
  const fotos = fotosDe(post)
  const nuevas = fotos.map((orig, i) => porClave.get(`${post.shortCode}|${i}`)?.url || orig)
  if (Array.isArray(post.childPosts) && post.childPosts.length) {
    post.childPosts.forEach((c, i) => {
      if (c && c.displayUrl) c.displayUrl = nuevas[i]
    })
    if (Array.isArray(post.images)) post.images = post.images.map((u, i) => nuevas[i] || u)
    if (post.displayUrl) post.displayUrl = nuevas[0]
  } else {
    if (post.displayUrl) post.displayUrl = nuevas[0]
    if (Array.isArray(post.images) && post.images.length) post.images = [nuevas[0]]
  }
}

if (dryRun) {
  console.log('--dry-run: no se escribe ningún fichero.')
  process.exit(0)
}

mkdirSync(DIR_DATASETS, { recursive: true })
const rutaDataset = join(DIR_DATASETS, `${nombre}.json`)
writeFileSync(rutaDataset, JSON.stringify(posts, null, 2) + '\n')

const resumen = {
  origen: rutaEntrada,
  preparado: new Date().toISOString(),
  fotos: detalle.length,
  porEstado: detalle.reduce((acc, f) => ((acc[f.estado] = (acc[f.estado] || 0) + 1), acc), {}),
  detalle,
}
writeFileSync(join(DIR_DATASETS, `${nombre}.imagenes.json`), JSON.stringify(resumen, null, 2) + '\n')

const rutaVerdad = join(DIR_DATASETS, `${nombre}.verdad.json`)
if (!existsSync(rutaVerdad)) {
  const esqueleto = posts.map((p) => ({
    shortCode: p.shortCode,
    publicado: p.timestamp || '',
    usuario: p.ownerUsername || '',
    _caption: String(p.caption || '').replace(/\s+/g, ' ').slice(0, 140),
    esperado: '',
    eventos: [],
  }))
  writeFileSync(rutaVerdad, JSON.stringify(esqueleto, null, 2) + '\n')
  console.log(`Esqueleto de verdad creado: ${rutaVerdad} — rellena "esperado" (evento|actividad|noticia|nada) y "eventos" a mano.`)
}
console.log(`Dataset escrito: ${rutaDataset}`)
console.log(`Por estado: ${JSON.stringify(resumen.porEstado)}`)
