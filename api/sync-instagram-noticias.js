// POST /api/sync-instagram-noticias — webhook de Apify: convierte posts de
// Instagram de ayuntamientonavalcarnero en noticias y alertas urgentes.
//
// Flujo: Apify termina su scrape → llama aquí → Claude identifica los posts
// que son noticias o alertas municipales (y descarta eventos de agenda, que ya
// cubre api/sync-instagram.js) → la imagen se sube a Vercel Blob → upsert en
// noticias_instagram por origen_externo_id ('ig-<shortCode>').
//
// Las noticias van a Neon y no a src/data/noticias.json a propósito: una
// alerta urgente ("corte de agua ahora") no puede esperar al ciclo
// commit→redeploy que regenera los JSON. GET /api/noticias-instagram las sirve
// y src/lib/useNoticiasPublicas.js las mezcla con el RSS; las alertas vigentes
// (urgente + expira_en > now) se filtran client-side, sin cron.
//
// Sin push a propósito: no hay columna notificado_en ni integración con
// api/_push-send.js — el destacado es solo visual (badge en Noticias, franja
// "Estado del municipio" en Inicio).
//
// Serverless (Node) a propósito: el SDK de Anthropic y @vercel/blob (undici)
// no funcionan en el Edge Runtime.
import Anthropic from '@anthropic-ai/sdk'
import { igualSeguro } from './_auth.js'
import { obtenerSql } from './_db.js'
import { MAX_POSTS, normalizarPost, obtenerPosts, subirImagen } from './_instagram.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

// Misma whitelist que el CHECK de noticias_instagram en db/schema.sql.
const TIPOS_ALERTA = ['incendio', 'corte_agua', 'corte_luz', 'trafico', 'emergencia', 'general']

// Una alerta urgente sin hora de fin conocida caduca sola a las 24 h de
// publicarse: una incidencia que dura más se re-anuncia con otro post.
const HORAS_EXPIRACION_DEFECTO = 24

// El json_schema fuerza la forma de la respuesta; los VALORES se validan
// aparte en validarExtraccion() — nunca se confía en la salida del modelo.
// Sin nullables: '' es el sentinel de "no aplica" (tipoAlerta/expiraEn).
const ESQUEMA_EXTRACCION = {
  type: 'object',
  additionalProperties: false,
  required: ['noticias'],
  properties: {
    noticias: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['shortCode', 'titulo', 'resumen', 'cuerpo', 'urgente', 'tipoAlerta', 'expiraEn'],
        properties: {
          shortCode: { type: 'string' },
          titulo: { type: 'string' },
          resumen: { type: 'string' },
          cuerpo: { type: 'string' },
          urgente: { type: 'boolean' },
          tipoAlerta: { enum: [...TIPOS_ALERTA, ''] },
          expiraEn: { type: 'string' },
        },
      },
    },
  },
}

const INSTRUCCIONES = `Analiza posts de Instagram del Ayuntamiento de Navalcarnero (Madrid) e identifica cuáles son NOTICIAS o ALERTAS municipales de interés práctico para un vecino.

Descarta:
- Anuncios de eventos de agenda (posts cuyo contenido principal es invitar a una actividad con fecha, hora y lugar): ya los cubre la agenda de la app.
- Felicitaciones, saludos institucionales, efemérides y posts sin información práctica.
- Sorteos y contenido puramente promocional.

Marca urgente=true SOLO si el post comunica una INTERRUPCIÓN CONCRETA de un servicio o una INSTRUCCIÓN DE SEGURIDAD ACCIONABLE que el vecino debe tener en cuenta ahora o en los próximos días. Es decir, algo que cambia lo que el vecino puede o debe hacer hoy:
- Cortes concretos: "la calle X estará cortada el día Y de 7:30 a 13:30", "corte de agua en el barrio Z mañana de 8 a 14 h", "corte de luz previsto...".
- Instrucciones de protección civil: "mantengan puertas y ventanas cerradas por el humo", "eviten la zona X", "se recomienda evacuar...".
- Emergencia activa con una acción o precaución concreta para el vecino.

NO es urgente (va como noticia normal, urgente=false) todo lo informativo o institucional, aunque hable de incendios o emergencias:
- Cómo se está gestionando una situación: "se ha instalado el puesto de mando avanzado", "visita de los ministros", "se habilitan pabellones por si fueran necesarios".
- Consejos genéricos de prevención sin una incidencia concreta en curso: "consejos ante las altas temperaturas", "recomendaciones de civismo en verano", "servicio de custodia de llaves".
- Balances, agradecimientos y actualizaciones de estado sin una acción concreta para el vecino.

En caso de duda, urgente=false (es una noticia). tipoAlerta: la opción más apropiada de la lista solo si urgente=true; "general" si es urgente pero no encaja en ninguna. Si el post NO es urgente, tipoAlerta = "".

expiraEn: si el caption indica cuándo termina la incidencia ("hasta las 14:00", "corte de 8 a 14 h"), devuélvelo como YYYY-MM-DDTHH:MM resolviendo fechas relativas con el campo "publicado" del post; si no se indica o el post no es urgente, "".

Para cada noticia devuelve además:
- shortCode: el del post, copiado tal cual.
- titulo: corto y legible en español (sin mayúsculas gritadas).
- resumen: una o dos frases, máximo 200 caracteres.
- cuerpo: el caption limpio de hashtags y menciones, máximo 1500 caracteres.

Devuelve solo los posts que son noticias o alertas; si ninguno lo es, devuelve la lista vacía.`

async function extraerNoticias(posts) {
  const client = new Anthropic()
  const respuesta = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: INSTRUCCIONES,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_EXTRACCION } },
    messages: [{ role: 'user', content: JSON.stringify(posts) }],
  })
  if (respuesta.stop_reason === 'refusal') {
    throw new Error('El modelo rechazó la petición de extracción.')
  }
  const texto = respuesta.content.find((b) => b.type === 'text')?.text || '{"noticias":[]}'
  return JSON.parse(texto).noticias || []
}

/** Fecha de publicación de la fila: el timestamp del post si es parseable. */
function fechaPublicacion(post) {
  const t = Date.parse(post.publicado)
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString()
}

/**
 * Valida los valores extraídos contra los posts realmente enviados y normaliza
 * la coherencia urgente/tipoAlerta/expiraEn (el CHECK alerta_coherente de la
 * tabla la exige): no urgente ⇒ ambos NULL; urgente sin expiración conocida ⇒
 * publicado + 24 h. Matiz asumido: el modelo devuelve la hora local de Madrid
 * sin offset y Postgres la lee como UTC, así que una alerta puede vivir 1-2 h
 * de más — fail-safe (nunca desaparece antes de tiempo).
 */
function validarExtraccion(noticias, postsPorShortCode) {
  const validas = []
  const descartadas = []
  const vistos = new Set()
  for (const n of Array.isArray(noticias) ? noticias : []) {
    const post = postsPorShortCode.get(n.shortCode)
    const valida =
      post && !vistos.has(n.shortCode) && typeof n.titulo === 'string' && n.titulo.trim()
    if (!valida) {
      descartadas.push(n.shortCode || '(sin shortCode)')
      continue
    }
    vistos.add(n.shortCode)

    const publicadoEn = fechaPublicacion(post)
    const urgente = n.urgente === true
    let tipoAlerta = null
    let expiraEn = null
    if (urgente) {
      tipoAlerta = TIPOS_ALERTA.includes(n.tipoAlerta) ? n.tipoAlerta : 'general'
      expiraEn = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(n.expiraEn)
        ? n.expiraEn
        : new Date(
            Date.parse(publicadoEn) + HORAS_EXPIRACION_DEFECTO * 3600 * 1000
          ).toISOString()
    }

    validas.push({
      shortCode: n.shortCode,
      titulo: n.titulo.trim().slice(0, 200),
      resumen: String(n.resumen || '').trim().slice(0, 300),
      cuerpo: String(n.cuerpo || '').trim().slice(0, 2000),
      urgente,
      tipoAlerta,
      expiraEn,
      publicadoEn,
      url: post.url,
      imagenOrigen: post.imagen,
      usuario: post.usuario,
    })
  }
  return { validas, descartadas }
}

/** Tabla e índice del upsert, idempotentes (también están en db/schema.sql). */
async function asegurarTabla(sql) {
  await sql`CREATE TABLE IF NOT EXISTS noticias_instagram (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    origen_externo_id text NOT NULL UNIQUE,
    titulo            text NOT NULL,
    resumen           text,
    cuerpo            text,
    imagen_url        text,
    url               text,
    usuario           text,
    urgente           boolean NOT NULL DEFAULT false,
    tipo_alerta       text CHECK (tipo_alerta IN ('incendio', 'corte_agua', 'corte_luz', 'trafico', 'emergencia', 'general')),
    publicado_en      timestamptz NOT NULL,
    expira_en         timestamptz,
    creado_en         timestamptz NOT NULL DEFAULT now(),
    actualizado_en    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT alerta_coherente CHECK ((urgente AND tipo_alerta IS NOT NULL) OR (NOT urgente AND tipo_alerta IS NULL))
  )`
  await sql`CREATE INDEX IF NOT EXISTS idx_noticias_ig_publicado
            ON noticias_instagram (publicado_en DESC)`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Usa POST.' })
    return
  }

  // Igual que sync-instagram: Bearer en tiempo constante, fallar cerrado sin
  // la env, y ?secret= porque en la config de webhooks de Apify es más simple
  // un query param que una cabecera. Secreto propio (NOTICIAS_SYNC_SECRET)
  // para poder rotarlo sin tocar el del webhook de eventos.
  const cabecera = req.headers['authorization'] || ''
  const secreto = process.env.NOTICIAS_SYNC_SECRET
  const autorizado =
    Boolean(secreto) &&
    ((await igualSeguro(cabecera, `Bearer ${secreto}`)) ||
      (await igualSeguro(String(req.query?.secret || ''), secreto)))
  if (!autorizado) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en el servidor.' })
    return
  }

  const resumen = {
    timestamp: new Date().toISOString(),
    recibidos: 0,
    analizados: 0,
    noticias: 0,
    creadas: 0,
    actualizadas: 0,
    descartadasPorValidacion: 0,
    imagenesSubidas: 0,
    errores: [],
  }

  try {
    const crudos = await obtenerPosts(req.body)
    resumen.recibidos = crudos.length

    const posts = crudos.map(normalizarPost).filter(Boolean).slice(0, MAX_POSTS)
    resumen.analizados = posts.length
    if (posts.length === 0) {
      res.status(200).json(resumen)
      return
    }

    const postsPorShortCode = new Map(posts.map((p) => [p.shortCode, p]))
    const extraidas = await extraerNoticias(
      posts.map(({ shortCode, caption, publicado }) => ({ shortCode, caption, publicado }))
    )
    const { validas, descartadas } = validarExtraccion(extraidas, postsPorShortCode)
    resumen.noticias = validas.length
    resumen.descartadasPorValidacion = descartadas.length
    if (descartadas.length) {
      resumen.errores.push(`Extracciones descartadas por validación: ${descartadas.join(', ')}`)
    }

    const sql = obtenerSql()
    await asegurarTabla(sql)

    for (const n of validas) {
      try {
        const imagenUrl = await subirImagen('instagram-noticias', n.shortCode, n.imagenOrigen)
        if (imagenUrl) resumen.imagenesSubidas++

        // xmax = 0 distingue INSERT de UPDATE. La imagen previa se conserva si
        // esta vez no se pudo subir; el resto de campos se re-escriben (una
        // corrección del post en Instagram debe reflejarse aquí).
        const filas = await sql`
          INSERT INTO noticias_instagram
            (origen_externo_id, titulo, resumen, cuerpo, imagen_url, url, usuario,
             urgente, tipo_alerta, publicado_en, expira_en)
          VALUES
            (${`ig-${n.shortCode}`}, ${n.titulo}, ${n.resumen}, ${n.cuerpo}, ${imagenUrl},
             ${n.url}, ${n.usuario}, ${n.urgente}, ${n.tipoAlerta}, ${n.publicadoEn},
             ${n.expiraEn})
          ON CONFLICT (origen_externo_id)
          DO UPDATE SET
            titulo = EXCLUDED.titulo,
            resumen = EXCLUDED.resumen,
            cuerpo = EXCLUDED.cuerpo,
            imagen_url = COALESCE(EXCLUDED.imagen_url, noticias_instagram.imagen_url),
            url = EXCLUDED.url,
            usuario = EXCLUDED.usuario,
            urgente = EXCLUDED.urgente,
            tipo_alerta = EXCLUDED.tipo_alerta,
            publicado_en = EXCLUDED.publicado_en,
            expira_en = EXCLUDED.expira_en,
            actualizado_en = now()
          RETURNING (xmax = 0) AS insertada
        `
        if (filas[0]?.insertada) resumen.creadas++
        else resumen.actualizadas++
      } catch (err) {
        resumen.errores.push(`Noticia ${n.shortCode}: ${err.message}`)
      }
    }

    console.log(JSON.stringify(resumen))
    res.status(200).json(resumen)
  } catch (err) {
    console.error('Error en sync-instagram-noticias:', err)
    resumen.errores.push(err.message)
    res.status(500).json(resumen)
  }
}
