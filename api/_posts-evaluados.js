// Pre-filtro de los webhooks de Instagram: qué posts ya evaluó el modelo.
//
// Cada run de Apify reenvía los ~15 posts más recientes de la cuenta, casi
// todos vistos en runs anteriores, y hasta aquí se volvían a mandar enteros a
// Claude (visión incluida) solo para que el upsert los encontrara ya hechos y
// el dedup los descartara. El dedup por origen_externo_id sigue en su sitio;
// esto evita llegar hasta él.
//
// Tabla posts_instagram_evaluados (db/schema.sql), clave (shortcode, webhook):
// - Se consulta UNA vez por run, antes de la extracción. Un post con fila y el
//   mismo hash del caption se salta; con el caption editado, se reevalúa.
// - Se inserta solo lo que el modelo evaluó con éxito, ACEPTADO O RECHAZADO
//   (un rechazo no deja fila en Neon, así que origen_externo_id no sirve de
//   marca). Nunca un post de un lote que falló, ni uno cuyo upsert o extracción
//   posterior falló: el siguiente run lo reintenta, como antes.
// - hash_caption NULL = fila de la siembra inicial: vale como "visto" para
//   cualquier caption y se rellena con el real en el primer salto, a partir
//   del cual las ediciones ya se detectan.
//
// Fail-open en la lectura (si Neon falla se evalúa todo, el comportamiento de
// siempre) y fail-soft en la escritura (si no se marca, el siguiente run vuelve
// a pagar ese post, nada más). El pre-filtro nunca puede tumbar un webhook.
//
// Solo Node (crypto). El guion bajo evita que Vercel lo despliegue como endpoint.
import { createHash } from 'node:crypto'
import { obtenerSql } from './_db.js'

export const WEBHOOKS = ['sync-instagram', 'sync-instagram-noticias']

/** Hash del caption ya normalizado (normalizarPost lo deja trim). */
export function hashCaption(caption) {
  return createHash('sha256').update(String(caption ?? '')).digest('hex')
}

// Por proceso: una instancia de Fluid sirve varios runs y la tabla solo hay
// que asegurarla una vez.
const aseguradas = new Set()

/**
 * Crea la tabla si falta (un despliegue anterior al db:setup no puede dejar el
 * webhook fallando) y, si este webhook no tiene ninguna fila, la siembra con
 * los shortCodes que ya tienen fila en Neon — así el primer run tras desplegar
 * no vuelve a pagar los posts ya aceptados. Los rechazados no dejaron rastro:
 * se evalúan una vez más y entran entonces.
 *
 * La siembra se decide por "este webhook no tiene filas" y no por "la tabla
 * se acaba de crear": si la creó db:setup, vacía, el primer run la sembraría
 * igual. Y no se repite nunca, porque tras ella siempre hay filas — borrar UNA
 * fila para forzar una reevaluación no la dispara. Dos runs simultáneos (las
 * dos cuentas disparan los dos webhooks) siembran a la vez sin problema: el
 * ON CONFLICT absorbe la carrera.
 *
 * Los shortCodes se sacan de la URL del post o del origen_externo_id: los dos
 * coinciden en todas las filas de producción (verificado 2026-10-19, todos de
 * 11 caracteres).
 */
async function asegurarYSembrar(sql, webhook) {
  if (aseguradas.has(webhook)) return
  await sql`CREATE TABLE IF NOT EXISTS posts_instagram_evaluados (
    shortcode     text NOT NULL,
    webhook       text NOT NULL CHECK (webhook IN ('sync-instagram', 'sync-instagram-noticias')),
    hash_caption  text,
    evaluado_en   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (shortcode, webhook)
  )`

  if (webhook === 'sync-instagram') {
    // Solo las filas con la URL del post: son las que crea este webhook. Las
    // ig-* con URL de navalcarnero.es salen de un PDF enlazado y las creó el
    // webhook de noticias.
    await sql`
      INSERT INTO posts_instagram_evaluados (shortcode, webhook)
      SELECT DISTINCT substring(url FROM 'instagram\\.com/(?:p|reel)/([A-Za-z0-9_-]+)'), 'sync-instagram'
      FROM eventos_usuario
      WHERE origen_externo_id LIKE 'ig-%'
        AND substring(url FROM 'instagram\\.com/(?:p|reel)/([A-Za-z0-9_-]+)') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM posts_instagram_evaluados WHERE webhook = 'sync-instagram')
      ON CONFLICT DO NOTHING`
  } else {
    // Noticias, actividades (fila única o hijas) y los eventos de agenda que
    // este webhook sacó de un PDF enlazado (los de URL no-Instagram).
    await sql`
      INSERT INTO posts_instagram_evaluados (shortcode, webhook)
      SELECT DISTINCT sc, 'sync-instagram-noticias'
      FROM (
        SELECT substring(origen_externo_id FROM '^ig-([A-Za-z0-9_-]{11})(?:-|$)') AS sc
          FROM noticias_instagram
        UNION
        SELECT substring(origen_externo_id FROM '^ig-([A-Za-z0-9_-]{11})(?:-|$)')
          FROM actividades WHERE origen_externo_id LIKE 'ig-%'
        UNION
        SELECT substring(origen_externo_id FROM '^ig-([A-Za-z0-9_-]{11})(?:-|$)')
          FROM eventos_usuario
          WHERE origen_externo_id LIKE 'ig-%' AND url NOT LIKE '%instagram.com/%'
      ) s
      WHERE sc IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM posts_instagram_evaluados WHERE webhook = 'sync-instagram-noticias')
      ON CONFLICT DO NOTHING`
  }
  aseguradas.add(webhook)
}

/**
 * Separa los posts en los que hay que mandar al modelo y los ya evaluados.
 * Devuelve {pendientes, saltados, reevaluadosPorEdicion, error}. Nunca lanza:
 * ante cualquier fallo devuelve todos como pendientes y el error en `error`.
 */
export async function filtrarYaEvaluados(webhook, posts) {
  if (!posts.length) return { pendientes: [], saltados: [], reevaluadosPorEdicion: 0, error: null }
  try {
    const sql = obtenerSql()
    await asegurarYSembrar(sql, webhook)
    const filas = await sql`
      SELECT shortcode, hash_caption
      FROM posts_instagram_evaluados
      WHERE webhook = ${webhook} AND shortcode = ANY(${posts.map((p) => p.shortCode)}::text[])`
    const hashPorShortCode = new Map(filas.map((f) => [f.shortcode, f.hash_caption]))

    const pendientes = []
    const saltados = []
    const sinHash = []
    let reevaluadosPorEdicion = 0
    for (const post of posts) {
      if (!hashPorShortCode.has(post.shortCode)) {
        pendientes.push(post)
        continue
      }
      const guardado = hashPorShortCode.get(post.shortCode)
      const actual = hashCaption(post.caption)
      if (guardado === null) {
        saltados.push(post)
        sinHash.push(post)
      } else if (guardado === actual) {
        saltados.push(post)
      } else {
        pendientes.push(post)
        reevaluadosPorEdicion++
      }
    }

    // Filas de la siembra: se rellena el hash con el caption de hoy para que
    // una edición posterior se detecte. Fallar aquí no cambia nada de este run.
    if (sinHash.length) {
      try {
        await sql`
          UPDATE posts_instagram_evaluados AS p
          SET hash_caption = v.hash
          FROM unnest(${sinHash.map((x) => x.shortCode)}::text[],
                      ${sinHash.map((x) => hashCaption(x.caption))}::text[]) AS v(shortcode, hash)
          WHERE p.webhook = ${webhook} AND p.shortcode = v.shortcode AND p.hash_caption IS NULL`
      } catch (err) {
        console.error(`[posts-evaluados] No se pudo rellenar el hash de la siembra (${webhook}):`, err.message)
      }
    }

    return { pendientes, saltados, reevaluadosPorEdicion, error: null }
  } catch (err) {
    console.error(`[posts-evaluados] Pre-filtro desactivado en este run (${webhook}):`, err.message)
    return { pendientes: posts, saltados: [], reevaluadosPorEdicion: 0, error: err.message }
  }
}

/**
 * Marca como evaluados los posts del run que el modelo evaluó con éxito.
 * Upsert: un post reevaluado por edición actualiza su hash. Devuelve cuántos
 * marcó (0 si falló; el error queda en consola y el siguiente run los repite).
 */
export async function marcarEvaluados(webhook, posts) {
  if (!posts.length) return 0
  try {
    const sql = obtenerSql()
    await sql`
      INSERT INTO posts_instagram_evaluados (shortcode, webhook, hash_caption, evaluado_en)
      SELECT v.shortcode, ${webhook}, v.hash, now()
      FROM unnest(${posts.map((p) => p.shortCode)}::text[],
                  ${posts.map((p) => hashCaption(p.caption))}::text[]) AS v(shortcode, hash)
      ON CONFLICT (shortcode, webhook)
      DO UPDATE SET hash_caption = EXCLUDED.hash_caption, evaluado_en = now()`
    return posts.length
  } catch (err) {
    console.error(`[posts-evaluados] No se pudieron marcar ${posts.length} posts (${webhook}):`, err.message)
    return 0
  }
}

/**
 * Estadísticas de un run, iguales en los dos webhooks: van en resumen y en la
 * columna `estadisticas` de ingesta_log, para medir el ahorro del pre-filtro
 * sin depender de la consola de Anthropic.
 * - enviados: posts que fueron al modelo (los pendientes tras el pre-filtro).
 * - evaluados: los que el modelo evaluó con éxito (los que se intentan marcar).
 * - marcados: los que quedaron escritos en la tabla (0 si la escritura falló).
 * - uso: tokens y llamadas a la API de TODAS las extracciones del run.
 */
export function estadisticasDe(resumen, { recientes, uso, evaluados = 0, marcados = 0 }) {
  return {
    postsRecibidos: resumen.recibidos,
    postsRecientes: recientes,
    postsSaltadosYaVistos: resumen.saltadosYaVistos || 0,
    postsReevaluadosPorEdicion: resumen.reevaluadosPorEdicion || 0,
    postsEnviadosAlModelo: resumen.analizados,
    postsEvaluadosConExito: evaluados,
    postsMarcados: marcados,
    llamadasClaude: uso.llamadas,
    tokensEntrada: uso.entrada,
    tokensSalida: uso.salida,
    tokensCacheEscrito: uso.cacheEscrito,
    tokensCacheLeido: uso.cacheLeido,
  }
}

/** Acumulador de uso de la API para un run: tokens y número de llamadas. */
export function nuevoUso() {
  return { llamadas: 0, entrada: 0, salida: 0, cacheEscrito: 0, cacheLeido: 0 }
}

/** Suma el `usage` de una respuesta de la API a un acumulador de nuevoUso(). */
export function sumarUso(uso, usage) {
  if (!uso || !usage) return
  uso.entrada += usage.input_tokens || 0
  uso.salida += usage.output_tokens || 0
  uso.cacheEscrito += usage.cache_creation_input_tokens || 0
  uso.cacheLeido += usage.cache_read_input_tokens || 0
}
