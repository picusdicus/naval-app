// POST /api/sync-instagram-noticias — webhook de Apify: convierte posts de
// Instagram municipales (ayuntamientonavalcarnero y cultura_navalcarnero) en
// noticias, alertas urgentes y ACTIVIDADES (inscripciones/plazos).
//
// Flujo: Apify termina su scrape → llama aquí → Claude hace el triaje de cada
// post: 'noticia' (información municipal; puede ser alerta urgente) o
// 'actividad' (algo a lo que apuntarse: talleres, escuelas deportivas,
// campamentos, ayudas… con su fecha_limite si el post la indica). Los eventos
// de agenda se descartan (ya los cubre api/sync-instagram.js) → la imagen se
// sube a Vercel Blob → upsert en noticias_instagram por origen_externo_id
// ('ig-<shortCode>').
//
// Las actividades alimentan la página /actividades; las noticias, la sección
// Noticias. Una actividad caduca sola al pasar fecha_limite (filtro en
// lectura, sin cron) y nunca es urgente (el servidor lo fuerza).
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
import { extraerActividadesDeHTML } from './_actividades-parser.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

// Misma whitelist que el CHECK de noticias_instagram en db/schema.sql.
const TIPOS_ALERTA = ['incendio', 'corte_agua', 'corte_luz', 'trafico', 'emergencia', 'general']

// Categorías de una actividad (misma whitelist que el CHECK de la tabla y que
// ETIQUETAS_ACTIVIDAD en src/lib/useNoticiasPublicas.js).
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
        required: ['shortCode', 'tipo', 'titulo', 'resumen', 'cuerpo', 'categoria', 'fechaLimite', 'urgente', 'tipoAlerta', 'expiraEn'],
        properties: {
          shortCode: { type: 'string' },
          tipo: { enum: ['noticia', 'actividad'] },
          titulo: { type: 'string' },
          resumen: { type: 'string' },
          cuerpo: { type: 'string' },
          // Solo para actividades; '' en noticias.
          categoria: { enum: [...CATEGORIAS_ACTIVIDAD, ''] },
          fechaLimite: { type: 'string' },
          urgente: { type: 'boolean' },
          tipoAlerta: { enum: [...TIPOS_ALERTA, ''] },
          expiraEn: { type: 'string' },
        },
      },
    },
  },
}

const INSTRUCCIONES = `Analiza posts de Instagram de cuentas municipales de Navalcarnero (Madrid) — el Ayuntamiento y la concejalía de cultura — e identifica cuáles son NOTICIAS, ALERTAS o ACTIVIDADES de interés práctico para un vecino, y clasifica cada uno en "tipo":

- tipo "actividad": el contenido principal es algo a lo que el vecino puede APUNTARSE o SOLICITAR — inscripciones a talleres, cursos, campamentos, escuelas deportivas, viajes organizados, ayudas, becas, subvenciones, bolsas de empleo público. Suele haber un plazo ("inscripciones hasta el 15", "plazo abierto del 1 al 30").
- tipo "noticia": el resto de información municipal (obras, comunicados, gestión de emergencias, balances). Puede ser además una alerta urgente (ver abajo).

Descarta:
- Anuncios de eventos de agenda (posts cuyo contenido principal es invitar a un acto puntual con fecha, hora y lugar — esos datos pueden estar en el caption o en el texto del cartel, campo "alt"): ya los cubre la agenda de la app. Ojo: si el post anuncia el PLAZO DE INSCRIPCIÓN a una actividad continuada (un taller trimestral, la escuela de fútbol), NO es un evento de agenda: es tipo "actividad".
- Felicitaciones, saludos institucionales, efemérides y posts sin información práctica.
- Sorteos y contenido puramente promocional.

Para las actividades devuelve además:
- categoria: la más apropiada de la lista permitida ("talleres" para cursos y talleres culturales o formativos, "ayudas" para subvenciones y becas, "general" si ninguna encaja). En noticias, "".
- fechaLimite: la fecha en que termina el plazo de inscripción o solicitud, como YYYY-MM-DD, resolviendo fechas relativas con el campo "publicado" del post; si el post no la indica (o es una noticia), "".
Una actividad nunca es urgente: en actividades, urgente=false, tipoAlerta="" y expiraEn="".

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

Para cada item (noticia o actividad) devuelve además:
- shortCode: el del post, copiado tal cual.
- titulo: corto y legible en español (sin mayúsculas gritadas).
- resumen: una o dos frases, máximo 200 caracteres.
- cuerpo: el caption limpio de hashtags y menciones, máximo 1500 caracteres.

Devuelve solo los posts que son noticias, alertas o actividades; si ninguno lo es, devuelve la lista vacía.`

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

/** Detecta URLs en el caption del post. */
function detectarUrl(caption) {
  if (!caption) return null
  const match = caption.match(/(https?:\/\/[^\s]+)/);
  return match ? match[1] : null
}

/** Scrapea una URL y extrae el HTML (máximo 50 KB para no saturar). */
async function scrapearUrl(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'NavalcarneroCrawler/1.0' },
      timeout: 10000,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const html = await response.text()
    // Limitar a los primeros 50 KB para no arrastrar demasiado contenido
    return html.substring(0, 51200)
  } catch (err) {
    throw new Error(`Error al scrapear ${url}: ${err.message}`)
  }
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
    const tipo = n.tipo === 'actividad' ? 'actividad' : 'noticia'
    // Solo una noticia puede ser urgente: una actividad con plazo no es una
    // alerta aunque el modelo la marque (coherencia forzada en servidor).
    const urgente = tipo === 'noticia' && n.urgente === true
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
    // categoria/fechaLimite solo aplican a actividades. Sin fecha límite la
    // actividad se muestra mientras siga en la ventana de historial del GET.
    let categoria = null
    let fechaLimite = null
    if (tipo === 'actividad') {
      categoria = CATEGORIAS_ACTIVIDAD.includes(n.categoria) ? n.categoria : 'general'
      fechaLimite = /^\d{4}-\d{2}-\d{2}$/.test(n.fechaLimite) ? n.fechaLimite : null
    }

    validas.push({
      shortCode: n.shortCode,
      tipo,
      titulo: n.titulo.trim().slice(0, 200),
      resumen: String(n.resumen || '').trim().slice(0, 300),
      cuerpo: String(n.cuerpo || '').trim().slice(0, 2000),
      categoria,
      fechaLimite,
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

/** Tablas e índices del upsert, idempotentes (también están en db/schema.sql). */
async function asegurarTablas(sql) {
  // noticias_instagram: solo noticias + alertas (actividades viven en su propia tabla).
  await sql`CREATE TABLE IF NOT EXISTS noticias_instagram (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    origen_externo_id text NOT NULL UNIQUE,
    titulo            text NOT NULL,
    resumen           text,
    cuerpo            text,
    imagen_url        text,
    url               text,
    usuario           text,
    tipo              text NOT NULL DEFAULT 'noticia' CHECK (tipo IN ('noticia')),
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

  // actividades: actividades con plazo de inscripción.
  await sql`CREATE TABLE IF NOT EXISTS actividades (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    origen_externo_id text NOT NULL UNIQUE,
    titulo            text NOT NULL,
    descripcion       text,
    categoria         text NOT NULL CHECK (categoria IN ('deporte', 'talleres', 'infantil', 'mayores', 'educacion', 'ayudas', 'empleo', 'general')),
    fecha_limite      date,
    horario           text,
    lugar             text,
    imagen_url        text,
    url_fuente        text,
    publicado_en      timestamptz NOT NULL DEFAULT now(),
    creado_en         timestamptz NOT NULL DEFAULT now(),
    actualizado_en    timestamptz NOT NULL DEFAULT now()
  )`
  await sql`CREATE INDEX IF NOT EXISTS idx_actividades_origen ON actividades (origen_externo_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_actividades_fecha_limite ON actividades (fecha_limite DESC)`
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
    actividades: 0,
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
      posts.map(({ shortCode, caption, alt, publicado }) => ({ shortCode, caption, alt, publicado }))
    )
    const { validas, descartadas } = validarExtraccion(extraidas, postsPorShortCode)
    resumen.noticias = validas.filter(v => v.tipo === 'noticia').length
    resumen.actividades = validas.filter(v => v.tipo === 'actividad').length
    resumen.descartadasPorValidacion = descartadas.length
    if (descartadas.length) {
      resumen.errores.push(`Extracciones descartadas por validación: ${descartadas.join(', ')}`)
    }

    const sql = obtenerSql()
    await asegurarTablas(sql)

    // Procesar noticias (tipo === 'noticia').
    for (const n of validas.filter(v => v.tipo === 'noticia')) {
      try {
        const imagenUrl = await subirImagen('instagram-noticias', n.shortCode, n.imagenOrigen)
        if (imagenUrl) resumen.imagenesSubidas++

        const filas = await sql`
          INSERT INTO noticias_instagram
            (origen_externo_id, titulo, resumen, cuerpo, imagen_url, url,
             usuario, urgente, tipo_alerta, publicado_en, expira_en)
          VALUES
            (${`ig-${n.shortCode}`}, ${n.titulo}, ${n.resumen}, ${n.cuerpo},
             ${imagenUrl}, ${n.url}, ${n.usuario}, ${n.urgente}, ${n.tipoAlerta},
             ${n.publicadoEn}, ${n.expiraEn})
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

    // Procesar actividades: si el post tiene URL, scrapearla y extraer actividades.
    for (const post of posts) {
      try {
        const url = detectarUrl(post.caption)
        if (!url) continue

        const html = await scrapearUrl(url)
        // Nuevo parser: parsing inteligente + Claude + manejo de imágenes
        const actividadesExtraidas = await extraerActividadesDeHTML(
          html,
          url,
          post.imagen, // Imagen del post de Instagram como fallback
          post.shortCode
        )
        if (actividadesExtraidas.length === 0) continue

        // Debug: log primera actividad extraída
        if (actividadesExtraidas.length > 0) {
          console.log(`[sync-instagram-noticias] ${post.shortCode}: primera actividad`)
          console.log(`  titulo: ${actividadesExtraidas[0]?.titulo}`)
          console.log(`  imagen_url: "${actividadesExtraidas[0]?.imagen_url || '(vacío)'}"`)
        }

        resumen.actividades += actividadesExtraidas.length

        for (let i = 0; i < actividadesExtraidas.length; i++) {
          const act = actividadesExtraidas[i]
          try {
            // ID único: post + índice (en caso de múltiples en el mismo post).
            const origenId = `ig-${post.shortCode}-${i}`

            await sql`
              INSERT INTO actividades
                (origen_externo_id, titulo, categoria, fecha_limite, horario, lugar,
                 imagen_url, url_fuente, publicado_en)
              VALUES
                (${origenId}, ${act.titulo}, ${act.categoria || 'general'}, ${act.fechaLimite},
                 ${act.horario}, ${act.lugar}, ${act.imagen_url}, ${url}, ${new Date(post.publicado || Date.now()).toISOString()})
              ON CONFLICT (origen_externo_id)
              DO UPDATE SET
                titulo = EXCLUDED.titulo,
                categoria = EXCLUDED.categoria,
                fecha_limite = EXCLUDED.fecha_limite,
                horario = EXCLUDED.horario,
                lugar = EXCLUDED.lugar,
                imagen_url = COALESCE(EXCLUDED.imagen_url, actividades.imagen_url),
                url_fuente = EXCLUDED.url_fuente,
                actualizado_en = now()
            `
            resumen.creadas++
            if (act.imagen_url) resumen.imagenesSubidas++
          } catch (err) {
            resumen.errores.push(`Actividad ${origenId}: ${err.message}`)
          }
        }
      } catch (err) {
        resumen.errores.push(`Scraping ${post.shortCode}: ${err.message}`)
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
