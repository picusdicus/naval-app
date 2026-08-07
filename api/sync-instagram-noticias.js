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
import { waitUntil } from '@vercel/functions'
import { igualSeguro } from './_auth.js'
import { obtenerSql } from './_db.js'
import {
  MAX_POSTS,
  asegurarOrganizacion,
  normalizarPost,
  obtenerPosts,
  orgDeUsuario,
  subirImagen,
} from './_instagram.js'
import { extraerDeDocumento } from './_actividades-parser.js'
import { enviarEmailPendientes } from './_email.js'
import { claveTitulo, titulosEquivalentes } from '../src/lib/dedupEventos.js'

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

// Tope de fotos por post: los carruseles pueden llegar a 15, pero 12 sobra de
// margen y acota el tiempo de función (una llamada de red por foto).
const MAX_IMAGENES_POST = 12

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
        required: ['shortCode', 'tipo', 'titulo', 'resumen', 'cuerpo', 'categoria', 'fechaLimite', 'urgente', 'tipoAlerta', 'expiraEn', 'programaEnlazada'],
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
          // true si el post remite a una programación/agenda en un enlace
          // ("consulta la programación", "descarga la agenda") — dispara el
          // scraping del documento enlazado.
          programaEnlazada: { type: 'boolean' },
        },
      },
    },
  },
}

const INSTRUCCIONES = `Analiza posts de Instagram de cuentas municipales de Navalcarnero (Madrid) — el Ayuntamiento y la concejalía de cultura — e identifica cuáles son NOTICIAS, ALERTAS o ACTIVIDADES de interés práctico para un vecino, y clasifica cada uno en "tipo":

- tipo "actividad": el contenido principal es algo a lo que el vecino puede APUNTARSE o SOLICITAR CON UN PLAZO EXPLÍCITO — inscripciones a talleres, cursos, campamentos, escuelas deportivas, ayudas, becas, subvenciones, bolsas de empleo público. REQUISITO: debe indicar claramente "hasta el X", "plazo abierto del X al Y", "inscripciones abiertas hasta", "solicitudes hasta". Si el post no menciona un plazo específico, es noticia, no actividad.
- tipo "noticia": el resto de información municipal (obras, comunicados, gestión de emergencias, balances, eventos puntuales, servicios ofrecidos sin plazo). Puede ser además una alerta urgente (ver abajo).

Descarta:
- Anuncios de eventos de agenda (posts cuyo contenido principal es invitar a un acto puntual con fecha, hora y lugar — esos datos pueden estar en el caption o en el texto del cartel, campo "alt"): ya los cubre la agenda de la app. Ojo: si el post anuncia el PLAZO DE INSCRIPCIÓN a una actividad continuada (un taller trimestral, la escuela de fútbol), NO es un evento de agenda: es tipo "actividad".
- Felicitaciones, saludos institucionales, efemérides y posts sin información práctica.
- Sorteos, campañas y contenido puramente promocional.
- Servicios puntuales sin plazo de inscripción (donaciones de sangre puntuales, servicios de custodia, etc.)

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
- programaEnlazada: true SOLO si el post remite a una programación o agenda completa que vive en un ENLACE del caption ("consulta la programación 👇", "descárgala aquí", "toda la agenda en el enlace") — típicamente la agenda cultural en PDF o una página con la programación deportiva. false si el enlace es de otro tipo (precios, un formulario, la web general) o no hay enlace.
- shortCode: el del post, copiado tal cual.
- titulo: corto y legible en español (sin mayúsculas gritadas).
- resumen: una o dos frases, máximo 200 caracteres.
- cuerpo: el caption limpio de hashtags y menciones, máximo 1500 caracteres. IMPORTANTE: conserva tal cual cualquier URL que aparezca en el caption (enlaces a navalcarnero.es, formularios, inscripciones…) — no la elimines ni la resumas, aunque esté al final o parezca una llamada a la acción.

Devuelve solo los posts que son noticias, alertas o actividades; si ninguno lo es, devuelve la lista vacía.`

// El triaje va en LOTES: con los 50 posts de un run en una sola llamada, la
// respuesta (título+resumen+cuerpo por item) superaba max_tokens, llegaba
// truncada y el JSON.parse tumbaba el run entero ("Unterminated string").
// Con lotes la salida queda acotada, y un lote fallido no arrastra al resto.
const LOTE_TRIAJE = 10

async function extraerNoticias(posts) {
  const client = new Anthropic()
  const lotes = []
  for (let i = 0; i < posts.length; i += LOTE_TRIAJE) {
    lotes.push(posts.slice(i, i + LOTE_TRIAJE))
  }
  // Lotes en paralelo: el tiempo total del triaje pasa a ser ~el de un lote
  // (5 llamadas concurrentes están muy lejos de los límites de la API).
  const resultados = await Promise.all(
    lotes.map(async (lote, idx) => {
      try {
        const respuesta = await client.messages.create({
          model: MODEL,
          max_tokens: 8192,
          system: INSTRUCCIONES,
          output_config: { format: { type: 'json_schema', schema: ESQUEMA_EXTRACCION } },
          messages: [{ role: 'user', content: JSON.stringify(lote) }],
        })
        if (respuesta.stop_reason === 'refusal') {
          throw new Error('el modelo rechazó la petición de extracción')
        }
        if (respuesta.stop_reason === 'max_tokens') {
          throw new Error(`respuesta truncada por max_tokens (${lote.length} posts en el lote)`)
        }
        const texto = respuesta.content.find((b) => b.type === 'text')?.text || '{"noticias":[]}'
        return { items: JSON.parse(texto).noticias || [] }
      } catch (err) {
        return { error: `Triaje lote ${idx + 1}: ${err.message}` }
      }
    })
  )
  const noticias = []
  const errores = []
  for (const r of resultados) {
    if (r.error) errores.push(r.error)
    else noticias.push(...r.items)
  }
  return { noticias, errores }
}

/** Primera URL del caption que apunte a la web municipal. Allowlist a
 * propósito: el caption viene de un tercero (Instagram) y este handler
 * scrapea lo que encuentre — solo se sigue a navalcarnero.es. */
function detectarUrl(caption) {
  if (!caption) return null
  for (const cruda of caption.match(/https?:\/\/[^\s]+/g) || []) {
    try {
      const u = new URL(cruda.replace(/[),.;]+$/, ''))
      if (u.hostname === 'navalcarnero.es' || u.hostname.endsWith('.navalcarnero.es')) {
        return u.href
      }
    } catch {
      // URL malformada en el caption: se ignora.
    }
  }
  return null
}

// Un PDF de agenda trimestral ronda 2-5 MB; 15 MB da margen sin acercarse al
// límite de la API de Anthropic (~32 MB de petición).
const MAX_PDF_BYTES = 15 * 1024 * 1024

/**
 * Descarga el documento enlazado y lo clasifica: {tipo: 'pdf', buffer} para
 * las agendas en PDF, {tipo: 'html', html} (máx 50 KB) para el resto.
 */
async function descargarDocumento(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'NavalcarneroCrawler/1.0' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim()
    if (contentType === 'application/pdf' || /\.pdf(?:[?#]|$)/i.test(url)) {
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length === 0 || buffer.length > MAX_PDF_BYTES) {
        throw new Error(`PDF fuera de límite (${buffer.length} bytes)`)
      }
      return { tipo: 'pdf', buffer }
    }
    const html = await response.text()
    return { tipo: 'html', html: html.substring(0, 51200) }
  } catch (err) {
    throw new Error(`Error al descargar ${url}: ${err.message}`)
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
      programaEnlazada: n.programaEnlazada === true,
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
      imagenesOrigen: post.imagenes,
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
  // Carrusel completo del post (ver db/schema.sql); imagen_url no cambia.
  await sql`ALTER TABLE noticias_instagram ADD COLUMN IF NOT EXISTS imagenes_url jsonb`
  // Columnas legacy del diseño de una sola tabla: el webhook ya no las
  // escribe (las actividades viven en su tabla), pero GET
  // /api/noticias-instagram las selecciona — sin ellas, una BD nueva
  // devolvería {noticias: []} en silencio.
  await sql`ALTER TABLE noticias_instagram ADD COLUMN IF NOT EXISTS categoria text`
  await sql`ALTER TABLE noticias_instagram ADD COLUMN IF NOT EXISTS fecha_limite date`

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
    estado            text NOT NULL DEFAULT 'publicado' CHECK (estado IN ('borrador', 'publicado', 'archivado')),
    publicado_en      timestamptz NOT NULL DEFAULT now(),
    creado_en         timestamptz NOT NULL DEFAULT now(),
    actualizado_en    timestamptz NOT NULL DEFAULT now()
  )`
  await sql`CREATE INDEX IF NOT EXISTS idx_actividades_origen ON actividades (origen_externo_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_actividades_fecha_limite ON actividades (fecha_limite DESC)`
  // Validación humana de lo extraído de documentos enlazados: nace 'borrador'
  // y el superadmin lo publica o archiva desde /admin → Pendientes. Las filas
  // preexistentes (y las del triaje directo) quedan 'publicado' por el DEFAULT.
  await sql`ALTER TABLE actividades ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'publicado'`
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

    // ACK inmediato (202): Apify corta el dispatch del webhook a los ~120 s y
    // lo REINTENTA entero — el triaje con Opus más los documentos enlazados
    // superan ese margen de sobra, y cada reintento duplicaba el trabajo. El
    // procesado sigue en segundo plano (waitUntil, Fluid) y el resumen final
    // queda en los logs de la función.
    res.status(202).json({
      aceptado: true,
      recibidos: resumen.recibidos,
      analizados: resumen.analizados,
    })
    const tarea = procesar(posts, resumen)
    try {
      waitUntil(tarea)
    } catch {
      // Fuera de Vercel (dev de Vite): la promesa sigue viva en el proceso.
    }
    return
  } catch (err) {
    console.error('Error en sync-instagram-noticias:', err)
    resumen.errores.push(err.message)
    if (!res.headersSent) res.status(500).json(resumen)
  }
}

/** Todo el trabajo pesado, ya sin una respuesta HTTP que mantener abierta. */
async function procesar(posts, resumen) {
  try {
    const postsPorShortCode = new Map(posts.map((p) => [p.shortCode, p]))
    const { noticias: extraidas, errores: erroresTriaje } = await extraerNoticias(
      posts.map(({ shortCode, caption, alt, publicado }) => ({ shortCode, caption, alt, publicado }))
    )
    resumen.errores.push(...erroresTriaje)
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
        // Todas las fotos del carrusel, truncadas a MAX_IMAGENES_POST. La
        // primera (i=0) va sin sufijo para conservar el nombre de blob
        // histórico; las subidas de un mismo post se paralelizan (no hay
        // dependencia entre ellas) manteniendo el orden del array — pero
        // nunca se paraleliza entre posts distintos.
        const origenes = (n.imagenesOrigen || []).slice(0, MAX_IMAGENES_POST)
        const subidas = await Promise.all(
          origenes.map((url, i) =>
            subirImagen('instagram-noticias', n.shortCode, url, i === 0 ? '' : String(i))
          )
        )
        const imagenes = subidas.filter(Boolean)
        resumen.imagenesSubidas += imagenes.length
        const imagenUrl = imagenes[0] || null
        const imagenesJson = imagenes.length > 0 ? JSON.stringify(imagenes) : null

        const filas = await sql`
          INSERT INTO noticias_instagram
            (origen_externo_id, titulo, resumen, cuerpo, imagen_url, imagenes_url, url,
             usuario, urgente, tipo_alerta, publicado_en, expira_en)
          VALUES
            (${`ig-${n.shortCode}`}, ${n.titulo}, ${n.resumen}, ${n.cuerpo},
             ${imagenUrl}, ${imagenesJson}::jsonb, ${n.url}, ${n.usuario}, ${n.urgente}, ${n.tipoAlerta},
             ${n.publicadoEn}, ${n.expiraEn})
          ON CONFLICT (origen_externo_id)
          DO UPDATE SET
            titulo = EXCLUDED.titulo,
            resumen = EXCLUDED.resumen,
            cuerpo = EXCLUDED.cuerpo,
            imagen_url = COALESCE(EXCLUDED.imagen_url, noticias_instagram.imagen_url),
            imagenes_url = COALESCE(EXCLUDED.imagenes_url, noticias_instagram.imagenes_url),
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

    // Programaciones enlazadas + actividades del triaje. Se procesan:
    // - los posts triados 'actividad' (con o sin enlace), y
    // - los posts con programaEnlazada=true y enlace municipal (p. ej. una
    //   noticia "ya está disponible la agenda" con el PDF enlazado).
    // Del documento enlazado (HTML de galería o PDF de agenda) salen
    // actividades y también EVENTOS de agenda; todo lo extraído de un
    // documento nace 'borrador' (un fallo de extracción son decenas de items)
    // y se valida en /admin → Pendientes, con aviso por email. La actividad
    // del propio triaje (caption, alta confianza) sigue naciendo 'publicado'.
    const pendientesEventos = []
    const pendientesActividades = []
    const procesables = validas.filter(
      (v) => v.tipo === 'actividad' || (v.programaEnlazada && detectarUrl(postsPorShortCode.get(v.shortCode).caption))
    )
    for (const item of procesables) {
      const post = postsPorShortCode.get(item.shortCode)
      try {
        // La foto del post, ya en Blob, como imagen de la fila única y
        // fallback de las extraídas (la URL cruda del CDN de Instagram
        // caduca en días).
        const imagenPost = await subirImagen('instagram-actividades', item.shortCode, item.imagenOrigen)
        if (imagenPost) resumen.imagenesSubidas++

        const url = detectarUrl(post.caption)
        let extraccion = { eventos: [], actividades: [] }
        if (url && (item.programaEnlazada || item.tipo === 'actividad')) {
          const doc = await descargarDocumento(url)
          extraccion = await extraerDeDocumento(doc, url, imagenPost, item.shortCode)
        }

        // — Actividades: hijas del documento (borrador) o, sin documento ni
        //   hijas, la del propio triaje (publicado directo, flujo rodado).
        const filasActividades = extraccion.actividades.length
          ? extraccion.actividades.map((h, i) => ({
              origenId: `ig-${item.shortCode}-${i}`,
              titulo: h.titulo,
              categoria: h.categoria || item.categoria || 'general',
              fechaLimite: h.fechaLimite || item.fechaLimite,
              horario: h.horario,
              lugar: h.lugar,
              descripcion: null,
              imagenUrl: h.imagen_url || imagenPost,
              estado: 'borrador',
            }))
          : item.tipo === 'actividad'
            ? [
                {
                  origenId: `ig-${item.shortCode}`,
                  titulo: item.titulo,
                  categoria: item.categoria || 'general',
                  fechaLimite: item.fechaLimite,
                  horario: null,
                  lugar: null,
                  descripcion: item.resumen || null,
                  imagenUrl: imagenPost,
                  estado: 'publicado',
                },
              ]
            : []

        for (const fila of filasActividades) {
          try {
            // El UPDATE no toca `estado` a propósito: un borrador ya publicado
            // o archivado desde /admin no se resetea al re-ejecutar el webhook.
            const resultado = await sql`
              INSERT INTO actividades
                (origen_externo_id, titulo, descripcion, categoria, fecha_limite, horario,
                 lugar, imagen_url, url_fuente, estado, publicado_en)
              VALUES
                (${fila.origenId}, ${fila.titulo}, ${fila.descripcion}, ${fila.categoria},
                 ${fila.fechaLimite}, ${fila.horario}, ${fila.lugar}, ${fila.imagenUrl},
                 ${url || post.url}, ${fila.estado}, ${item.publicadoEn})
              ON CONFLICT (origen_externo_id)
              DO UPDATE SET
                titulo = EXCLUDED.titulo,
                descripcion = EXCLUDED.descripcion,
                categoria = EXCLUDED.categoria,
                fecha_limite = EXCLUDED.fecha_limite,
                horario = EXCLUDED.horario,
                lugar = EXCLUDED.lugar,
                imagen_url = COALESCE(EXCLUDED.imagen_url, actividades.imagen_url),
                url_fuente = EXCLUDED.url_fuente,
                actualizado_en = now()
              RETURNING (xmax = 0) AS insertada
            `
            if (resultado[0]?.insertada) {
              resumen.creadas++
              if (fila.estado === 'borrador') {
                pendientesActividades.push({ titulo: fila.titulo, fecha: fila.fechaLimite })
              }
            } else {
              resumen.actualizadas++
            }
          } catch (err) {
            resumen.errores.push(`Actividad ${fila.origenId}: ${err.message}`)
          }
        }

        // — Eventos del documento (solo PDF de agenda los trae): nacen
        //   'borrador' bajo la organización del autor del post, con dedup
        //   contra los eventos ya existentes en esas fechas (misma fecha +
        //   título equivalente ⇒ se omite). El UPDATE del upsert no toca
        //   estado ni notificado_en: publicar es decisión del superadmin y,
        //   al publicar, el digest del cron lo anuncia como a cualquier otro.
        if (extraccion.eventos.length) {
          const organizacionId = await asegurarOrganizacion(sql, orgDeUsuario(item.usuario))
          const fechasDoc = [...new Set(extraccion.eventos.map((e) => e.fecha))]
          const existentes = await sql`
            SELECT origen_externo_id, titulo, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha
            FROM eventos_usuario
            WHERE fecha_inicio = ANY(${fechasDoc}::date[])`
          for (let i = 0; i < extraccion.eventos.length; i++) {
            const ev = extraccion.eventos[i]
            const origenId = `ig-${item.shortCode}-${i}`
            try {
              const clave = claveTitulo(ev.titulo)
              const gemelo = existentes.find(
                (e) =>
                  e.fecha === ev.fecha &&
                  e.origen_externo_id !== origenId &&
                  titulosEquivalentes(claveTitulo(e.titulo), clave)
              )
              if (gemelo) continue

              const filas = await sql`
                INSERT INTO eventos_usuario
                  (organizacion_id, titulo, descripcion, categoria,
                   fecha_inicio, hora, lugar, url, imagen_url, estado, origen_externo_id)
                VALUES
                  (${organizacionId}, ${ev.titulo}, ${ev.descripcion}, ${ev.categoria},
                   ${ev.fecha}, ${ev.hora}, ${ev.lugar}, ${url}, ${imagenPost},
                   'borrador', ${origenId})
                ON CONFLICT (origen_externo_id) WHERE origen_externo_id IS NOT NULL
                DO UPDATE SET
                  titulo = EXCLUDED.titulo,
                  descripcion = EXCLUDED.descripcion,
                  categoria = EXCLUDED.categoria,
                  fecha_inicio = EXCLUDED.fecha_inicio,
                  hora = EXCLUDED.hora,
                  lugar = EXCLUDED.lugar,
                  url = EXCLUDED.url,
                  imagen_url = COALESCE(EXCLUDED.imagen_url, eventos_usuario.imagen_url),
                  actualizado_en = now()
                RETURNING (xmax = 0) AS insertado
              `
              if (filas[0]?.insertado) {
                resumen.creadas++
                pendientesEventos.push({ titulo: ev.titulo, fecha: ev.fecha })
                existentes.push({ origen_externo_id: origenId, titulo: ev.titulo, fecha: ev.fecha })
              } else {
                resumen.actualizadas++
              }
            } catch (err) {
              resumen.errores.push(`Evento ${origenId}: ${err.message}`)
            }
          }
        }
      } catch (err) {
        resumen.errores.push(`Scraping ${item.shortCode}: ${err.message}`)
      }
    }

    // Aviso por email al superadmin si el run dejó borradores por validar.
    // Fail-soft: un fallo del email no rompe la sincronización.
    if (pendientesEventos.length || pendientesActividades.length) {
      resumen.pendientesValidacion =
        pendientesEventos.length + pendientesActividades.length
      try {
        await enviarEmailPendientes({
          eventos: pendientesEventos,
          actividades: pendientesActividades,
        })
      } catch (err) {
        resumen.errores.push(`Email de pendientes: ${err.message}`)
      }
    }

    console.log(JSON.stringify(resumen))
  } catch (err) {
    console.error('Error en sync-instagram-noticias (fondo):', err)
    resumen.errores.push(err.message)
    console.log(JSON.stringify(resumen))
  }
}
