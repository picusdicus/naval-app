// Recuperación manual de imágenes que se quedaron sin subir a Vercel Blob
// (store pausado por cuota, fallo de red puntual, tipo de imagen no
// admitido…). Busca en Neon las filas sincronizadas desde Instagram
// (origen_externo_id 'ig-<shortCode>') de eventos_usuario y
// noticias_instagram con imagen_url a NULL, en los últimos N días, y sube su
// foto de portada con la misma convención de nombre que usan los webhooks
// (api/_instagram.js: subirImagen).
//
// NO se ejecuta en el cron ni en ningún webhook — es una herramienta de mano
// para después de reactivar el store, o tras cualquier incidente que haya
// dejado imágenes sin subir. Solo rellena `imagen_url` (la foto de portada);
// no reconstruye la galería completa (imagenes_url) de las noticias.
//
// Reconstrucción de la URL de origen: ni eventos_usuario ni noticias_instagram
// guardan la URL firmada del CDN de Instagram (caduca en días y nunca se
// persistió) — solo la URL pública del post. Este script vuelve a pedir esa
// página y lee su <meta property="og:image">. Instagram puede bloquear o
// devolver una página sin ese meta a peticiones sin sesión: un fallo aquí se
// cuenta y se salta al siguiente, nunca rompe el run.
//
//   node scripts/rellenar-imagenes.mjs [--dias=30] [--limite=100] [--dry-run]
//
// --dias    ventana de antigüedad (por creado_en) de las filas a mirar. 30 por defecto.
// --limite  tope de imágenes a INTENTAR subir en esta ejecución (cada intento
//           que llega a Blob cuenta como Advanced Request). 100 por defecto.
// --dry-run lista lo que se subiría sin llamar a Blob ni tocar Neon.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'
import { subirImagen } from '../api/_instagram.js'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Vuelca las claves de un fichero .env en process.env sin pisar lo existente. */
function cargarEnv(fichero) {
  let contenido
  try {
    contenido = readFileSync(resolve(raiz, fichero), 'utf8')
  } catch {
    return
  }
  for (const linea of contenido.split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    const valor = m[2].replace(/^["']|["']$/g, '')
    if (!process.env[m[1]]) process.env[m[1]] = valor
  }
}
cargarEnv('.env.local')
cargarEnv('.env')

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!url) {
  console.error('Falta DATABASE_URL. Ejecuta: npx vercel env pull .env.local')
  process.exit(1)
}
const sql = neon(url)

const argv = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [clave, valor] = arg.replace(/^--/, '').split('=')
    return [clave, valor ?? true]
  })
)
const DIAS = Number(argv.dias) > 0 ? Number(argv.dias) : 30
const LIMITE = Number(argv.limite) > 0 ? Number(argv.limite) : 100
const DRY_RUN = Boolean(argv['dry-run'])

/** Instagram no expone la URL firmada del CDN salvo en el momento de la
 * ingesta — se vuelve a pedir la página pública del post y se lee su
 * og:image (regenerada en cada carga, válida mientras el post siga público).
 * Puede fallar si el post se borró o si Instagram bloquea la petición sin
 * sesión: se lanza y el llamador decide qué hacer (aquí, saltar el item). */
async function imagenOrigenDe(shortCode) {
  const res = await fetch(`https://www.instagram.com/p/${shortCode}/`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavalcarneroApp/0.1; +https://ennavalcarnero.es)' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir la página del post`)
  const html = await res.text()
  const m = html.match(/<meta property="og:image" content="([^"]+)"/)
  if (!m) throw new Error('la página del post no trae og:image (¿bloqueo de Instagram o post eliminado?)')
  return m[1].replace(/&amp;/g, '&')
}

async function eventosSinImagen() {
  return sql`
    SELECT id, origen_externo_id
    FROM eventos_usuario
    WHERE origen_externo_id LIKE 'ig-%'
      AND imagen_url IS NULL
      AND creado_en >= now() - make_interval(days => ${DIAS})
    ORDER BY creado_en DESC
  `
}

async function noticiasSinImagen() {
  return sql`
    SELECT id, origen_externo_id
    FROM noticias_instagram
    WHERE origen_externo_id LIKE 'ig-%'
      AND imagen_url IS NULL
      AND creado_en >= now() - make_interval(days => ${DIAS})
    ORDER BY creado_en DESC
  `
}

async function guardarImagenEvento(id, imagenUrl) {
  await sql`UPDATE eventos_usuario SET imagen_url = ${imagenUrl}, actualizado_en = now() WHERE id = ${id}`
}

async function guardarImagenNoticia(id, imagenUrl) {
  await sql`
    UPDATE noticias_instagram
    SET imagen_url = ${imagenUrl},
        imagenes_url = COALESCE(imagenes_url, ${JSON.stringify([imagenUrl])}::jsonb),
        actualizado_en = now()
    WHERE id = ${id}`
}

async function rellenar() {
  const [eventos, noticias] = await Promise.all([eventosSinImagen(), noticiasSinImagen()])

  const candidatos = [
    ...eventos.map((f) => ({ tabla: 'eventos_usuario', prefijoBlob: 'instagram', ...f })),
    ...noticias.map((f) => ({ tabla: 'noticias_instagram', prefijoBlob: 'instagram-noticias', ...f })),
  ]

  console.log(
    `Pendientes de imagen (últimos ${DIAS} días): ${eventos.length} eventos, ${noticias.length} noticias.`
  )
  if (candidatos.length === 0) {
    console.log('Nada que hacer.')
    return
  }

  const aProcesar = candidatos.slice(0, LIMITE)
  if (candidatos.length > aProcesar.length) {
    console.log(
      `Límite de ${LIMITE} operaciones por ejecución: se procesan ${aProcesar.length} de ${candidatos.length}. Vuelve a ejecutar para el resto.`
    )
  }

  const resumen = { intentadas: aProcesar.length, subidas: 0, fallidas: 0 }

  for (const c of aProcesar) {
    const shortCode = c.origen_externo_id.slice('ig-'.length)
    if (DRY_RUN) {
      console.log(`[dry-run] ${c.tabla} ${c.origen_externo_id} (${shortCode}) — se intentaría rellenar`)
      continue
    }
    try {
      const imagenOrigen = await imagenOrigenDe(shortCode)
      const imagenUrl = await subirImagen(c.prefijoBlob, shortCode, imagenOrigen)
      if (!imagenUrl) throw new Error('subirImagen devolvió null (ver log anterior)')

      if (c.tabla === 'eventos_usuario') await guardarImagenEvento(c.id, imagenUrl)
      else await guardarImagenNoticia(c.id, imagenUrl)

      resumen.subidas++
      console.log(`✓ ${c.tabla} ${c.origen_externo_id} → ${imagenUrl}`)
    } catch (err) {
      resumen.fallidas++
      console.warn(`✗ ${c.tabla} ${c.origen_externo_id}: ${err.message}`)
    }
  }

  console.log(DRY_RUN ? 'Dry-run terminado (nada subido, nada actualizado).' : 'Terminado.')
  console.log(JSON.stringify(resumen))
}

await rellenar()
