// Utilidades compartidas por el arnés de comparación de modelos
// (bench-modelos.mjs) y por la preparación de datasets (preparar-dataset.mjs).
// Ver PLAN_MODELOS.md, fase 1.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DIR_BENCH = dirname(fileURLToPath(import.meta.url))
export const DIR_DATASETS = join(DIR_BENCH, 'datasets')
export const DIR_RESULTADOS = join(DIR_BENCH, 'resultados')
export const RAIZ = resolve(DIR_BENCH, '..', '..')

// Hosts en los que una URL de imagen se considera ESTABLE (no caduca). Las
// URLs firmadas del CDN de Instagram (cdninstagram.com / fbcdn.net) caducan
// a los ~4 días de la ejecución de Apify; un dataset que las conserve deja
// de reproducir el run real en cuanto pasan.
export const HOSTS_ESTABLES = [/\.public\.blob\.vercel-storage\.com$/i]

export function urlEstable(url) {
  try {
    const { hostname } = new URL(url)
    return HOSTS_ESTABLES.some((re) => re.test(hostname))
  } catch {
    return false
  }
}

/**
 * Carga en process.env SOLO las variables de la lista blanca, leyendo
 * .env.local y .env de la raíz (CRLF incluido: en Windows `.` no casa `\r` y
 * un `(.*)$` sin quitarlo no encuentra ninguna línea). Nunca pisa una
 * variable ya presente en el entorno.
 */
export function cargarEnv(permitidas) {
  const permitidasSet = new Set(permitidas)
  for (const f of ['.env.local', '.env']) {
    const ruta = join(RAIZ, f)
    if (!existsSync(ruta)) continue
    for (const linea of readFileSync(ruta, 'utf8').replace(/\r/g, '').split('\n')) {
      const m = linea.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/)
      if (!m || !permitidasSet.has(m[1]) || process.env[m[1]]) continue
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
}

// Variables que, si estuvieran en el entorno, permitirían a una función
// importada tocar Neon, Blob o el correo. El bench las borra ANTES de
// importar los handlers: "cero efectos secundarios" es una garantía del
// entorno, no una promesa de no llamar a nada.
export const VARIABLES_CON_EFECTOS = [
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'BLOB_READ_WRITE_TOKEN',
  'BLOB_STORE_ID',
  'VERCEL_OIDC_TOKEN',
  'RESEND_API_KEY',
  'APIFY_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
]

// Claves de proveedor que el bench SÍ toma del .env (formato del plan: una
// clave por proveedor; solo hace falta la del proveedor que se use).
export const CLAVES_PROVEEDOR = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'MOONSHOT_API_KEY',
  'MOONSHOT_BASE_URL',
]

export function leerJson(ruta) {
  return JSON.parse(readFileSync(ruta, 'utf8'))
}

/** Posts crudos de un fichero de Apify (array, {posts: []} o {items: []}). */
export function postsDeFichero(ruta) {
  const crudos = leerJson(ruta)
  const lista = Array.isArray(crudos) ? crudos : crudos.posts || crudos.items || []
  if (!Array.isArray(lista)) throw new Error(`${ruta}: no contiene una lista de posts`)
  return lista
}

/** Datasets disponibles: <nombre>.json con su <nombre>.verdad.json al lado. */
export function listarDatasets() {
  if (!existsSync(DIR_DATASETS)) return []
  return readdirSync(DIR_DATASETS)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.verdad.json') && !f.endsWith('.imagenes.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((n) => existsSync(join(DIR_DATASETS, `${n}.verdad.json`)))
    .sort()
}

/** `--clave=valor` → valor; `--clave` → true; ausente → defecto. */
export function argumento(args, clave, defecto) {
  const hit = args.find((a) => a === `--${clave}` || a.startsWith(`--${clave}=`))
  if (!hit) return defecto
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true
}
