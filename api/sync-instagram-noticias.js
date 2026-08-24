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
  esPostReciente,
  normalizarPost,
  obtenerPosts,
  orgDeUsuario,
  subirImagen,
} from './_instagram.js'
import { extraerDeCarrusel, extraerDeDocumento } from './_actividades-parser.js'
import { enviarEmailPendientes } from './_email.js'
import { claveTitulo, titulosEquivalentes } from '../src/lib/dedupEventos.js'
import { registrarIngesta } from './_ingesta-log.js'

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

// Tope de fotos por post: los carruseles pueden llegar a 15, pero 6 cubre la
// práctica totalidad de los carteles municipales y acota tanto el tiempo de
// función como el número de Advanced Requests de Blob que puede llegar a
// costar un solo post (ver "Presupuesto de Vercel Blob" en CLAUDE.md).
const MAX_IMAGENES_POST = 6

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
- tipo "noticia": el resto de información municipal con utilidad práctica para el vecino — obras, comunicados, gestión de emergencias, balances, y también los SERVICIOS MUNICIPALES (objetos perdidos, custodia de llaves, donaciones de sangre, asesorías) y las CAMPAÑAS MUNICIPALES con información práctica (p. ej. el sorteo del comercio local "Yo compro en Navalcarnero"): si el post da teléfonos, horarios, fechas, lugares o explica cómo participar, es noticia. Puede ser además una alerta urgente (ver abajo).

Descarta:
- Anuncios de eventos de agenda (posts cuyo contenido principal es invitar a un acto puntual con fecha, hora y lugar — esos datos pueden estar en el caption o en el texto del cartel, campo "alt"): ya los cubre la agenda de la app. Un acto al que solo se ASISTE como público (una proyección de cine —incluido el cine de verano—, un concierto, una función) es SIEMPRE un evento de agenda, nunca una actividad, aunque sea recurrente o gratuito. Ojo: si el post anuncia el PLAZO DE INSCRIPCIÓN a una actividad continuada (un taller trimestral, la escuela de fútbol), NO es un evento de agenda: es tipo "actividad".
- Felicitaciones, saludos institucionales, efemérides y teasers o promoción SIN información práctica (sin fechas, teléfonos, lugares ni nada que el vecino pueda usar — "pronto llegan las fiestas" no es una noticia; el programa, cuando salga, sí).

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
  console.log('[webhook] Triaje: noticias=', noticias.map(n => ({ shortCode: n.shortCode, tipo: n.tipo, titulo: n.titulo })))
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
/**
 * Descarga HTML o PDF desde una URL. Para HTML, extrae el contenido principal
 * del artículo y descarta cabecera, menú, sidebar para maximizar el contenido útil
 * antes de aplicar el límite de tamaño (evita truncamiento de galerias al final).
 */
async function descargarDocumento(url) {
  const MAX_HTML_BYTES = 300_000 // 300 KB: páginas municipales largas (39+ actividades)

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

    let html = await response.text()
    const htmlOriginalSize = html.length

    // Recortar por contenido: extraer solo el artículo principal (WordPress)
    // y descartar cabecera, menú, sidebar para maximizar contenido útil.
    // Los selectores son específicos del WordPress de Navalcarnero (art-postcontent o entrada).
    const match = html.match(/<div[^>]*class="[^"]*(?:entrada|art-postcontent)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)
    if (match && match[1].length > 1000) {
      // Si el contenido extraído es significativo, úsalo (descarta chrome de la página)
      html = match[1]
      console.log(`[descargarDocumento] Contenido extraído: ${htmlOriginalSize} → ${html.length} bytes`)
    }

    // Aplicar límite de tamaño DESPUÉS del recorte por contenido
    if (html.length > MAX_HTML_BYTES) {
      console.warn(
        `[descargarDocumento] HTML truncado: ${html.length} → ${MAX_HTML_BYTES} bytes (límite) de ${url}`
      )
      html = html.substring(0, MAX_HTML_BYTES)
    }

    return { tipo: 'html', html }
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
    // Un triaje por post ES la semántica correcta aquí (a diferencia del
    // dedup por shortCode que hubo en sync-instagram.js): este `vistos`
    // deduplica la CLASIFICACIÓN del post (noticia o actividad), y el
    // contenido múltiple de un carrusel sale después, en la extracción de
    // documento/carrusel, con id propio por hija.
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
  // Id estable de la foto de origen (media id/shortcode de Instagram) para
  // reconocer si la imagen de una hija de carrusel ya está subida aunque el
  // post se reedite y las fotos cambien de orden — ver carruselDe() en
  // api/_instagram.js. NULL fuera de carruseles y en filas anteriores a esto.
  await sql`ALTER TABLE actividades ADD COLUMN IF NOT EXISTS imagen_origen_id text`
  // Fecha de celebración/realización de la actividad, distinto de fecha_limite
  // (cuándo cierra el plazo de inscripción). Nullable: actividades sin fecha.
  await sql`ALTER TABLE actividades ADD COLUMN IF NOT EXISTS fecha_evento date`
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
    descartadosPorAntiguedad: 0,
    noticias: 0,
    actividades: 0,
    creadas: 0,
    actualizadas: 0,
    descartadasPorValidacion: 0,
    imagenesSubidas: 0,
    imagenesReutilizadas: 0,
    errores: [],
  }

  try {
    const crudos = await obtenerPosts(req.body)
    resumen.recibidos = crudos.length

    const normalizados = crudos.map(normalizarPost).filter(Boolean)
    const posts = normalizados.filter((p) => esPostReciente(p)).slice(0, MAX_POSTS)
    resumen.descartadosPorAntiguedad = normalizados.length - posts.length
    resumen.analizados = posts.length
    const noNormalizables = crudos.length - normalizados.length
    if (posts.length === 0) {
      await registrarIngesta({
        fuente: 'sync-instagram-noticias',
        candidatos: resumen.recibidos,
        motivos: {
          'post no normalizable': noNormalizables,
          'antigüedad (>30 días) o tope de posts': resumen.descartadosPorAntiguedad,
        },
      })
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
    const tarea = procesar(posts, resumen, noNormalizables)
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
async function procesar(posts, resumen, noNormalizables = 0) {
  // Cuántos items devolvió el triaje: lo que falte hasta `analizados` son
  // posts que el modelo consideró irrelevantes (eventos de agenda,
  // felicitaciones, teasers…). Los eventos duplicados de un documento
  // enlazado se cuentan aparte (el `continue` del gemelo no dejaba rastro).
  let extraidasTotal = 0
  let eventosDocDuplicados = 0
  try {
    const postsPorShortCode = new Map(posts.map((p) => [p.shortCode, p]))
    const { noticias: extraidas, errores: erroresTriaje } = await extraerNoticias(
      posts.map(({ shortCode, caption, alt, publicado }) => ({ shortCode, caption, alt, publicado }))
    )
    resumen.errores.push(...erroresTriaje)
    extraidasTotal = extraidas.length
    const { validas, descartadas } = validarExtraccion(extraidas, postsPorShortCode)
    resumen.noticias = validas.filter(v => v.tipo === 'noticia').length
    resumen.actividades = validas.filter(v => v.tipo === 'actividad').length
    resumen.descartadasPorValidacion = descartadas.length
    if (descartadas.length) {
      resumen.errores.push(`Extracciones descartadas por validación: ${descartadas.join(', ')}`)
    }

    const sql = obtenerSql()
    await asegurarTablas(sql)

    // Imágenes ya subidas de las noticias (misma idea que en el webhook de
    // eventos: una sola consulta antes del bucle, cuota de Blob — ver
    // "Presupuesto de Vercel Blob" en CLAUDE.md). Se trata la galería como un
    // bloque: si la fila ya tiene imagen_url, se reutiliza también su
    // imagenes_url guardada sin volver a pedir ninguna foto del carrusel.
    const idsNoticias = validas.filter((v) => v.tipo === 'noticia').map((n) => `ig-${n.shortCode}`)
    const imagenesNoticiasPrevias = idsNoticias.length
      ? await sql`
          SELECT origen_externo_id, imagen_url, imagenes_url
          FROM noticias_instagram
          WHERE origen_externo_id = ANY(${idsNoticias}::text[])`
      : []
    const noticiaPorOrigenId = new Map(imagenesNoticiasPrevias.map((f) => [f.origen_externo_id, f]))

    // Procesar noticias (tipo === 'noticia').
    for (const n of validas.filter(v => v.tipo === 'noticia')) {
      try {
        const previa = noticiaPorOrigenId.get(`ig-${n.shortCode}`)
        let imagenUrl, imagenesJson
        if (previa?.imagen_url) {
          imagenUrl = previa.imagen_url
          imagenesJson = Array.isArray(previa.imagenes_url) ? JSON.stringify(previa.imagenes_url) : null
          resumen.imagenesReutilizadas++
        } else {
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
          imagenUrl = imagenes[0] || null
          imagenesJson = imagenes.length > 0 ? JSON.stringify(imagenes) : null
        }

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
    // Encuentra, entre las hermanas ya existentes de un post, la que
    // corresponde a esta foto/actividad — por id estable de la foto si está
    // disponible en ambos lados (Instagram no lo cambia si el post se
    // reedita), si no por título equivalente. MISMO criterio para las dos
    // decisiones que dependen de "es esta la misma hija de antes": qué
    // imagen reutilizar (más abajo) y qué origen_externo_id reutilizar
    // (idDeHija) — así no pueden discrepar entre sí. El título por sí solo
    // es frágil como identidad: Claude puede redactar el mismo cartel
    // distinto entre dos extracciones ("Torneo de Pádel" / "Torneo de
    // pádel otoñal"), y confundir dos actividades reales con nombres
    // parecidos ("Torneo de Pádel" / "Torneo de Pádel Infantil"). Es el
    // único criterio disponible para actividades sin foto propia
    // (documentos PDF/HTML) o cuando el actor de Apify no da el id.
    const hermanaDe = (hermanas, { imagenOrigenId, titulo }) => {
      if (imagenOrigenId) {
        const porId = hermanas.find((x) => x.imagen_origen_id === imagenOrigenId)
        if (porId) return porId
      }
      const clave = claveTitulo(titulo)
      return hermanas.find((x) => titulosEquivalentes(claveTitulo(x.titulo), clave))
    }
    // Sufijo ESTABLE por título para los ids de hijas ('ig-<shortCode>-<slug>'):
    // con índices numéricos, el orden de extracción cambiaba entre runs y el
    // upsert machacaba una fila con el contenido de otra (un "Reto viajero"
    // publicado amaneció convertido en "Torneo F7 Veteranos"). Colisiones
    // dentro del mismo post se numeran (-2, -3…).
    const sufijoDe = (titulo, usados) => {
      const base =
        claveTitulo(titulo).replace(/ /g, '-').slice(0, 48).replace(/-+$/, '') || 'item'
      let slug = base
      for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`
      usados.add(slug)
      return slug
    }
    const procesables = validas.filter(
      (v) => v.tipo === 'actividad' || (v.programaEnlazada && detectarUrl(postsPorShortCode.get(v.shortCode).caption))
    )

    // Imágenes y hermanas ya existentes de los posts a procesar: una sola
    // consulta antes del bucle (cuota de Blob — ver "Presupuesto de Vercel
    // Blob" en CLAUDE.md), en vez de la consulta por-post que había antes.
    // Un patrón 'ig-<shortCode>%' cubre a la vez la fila única
    // (ig-<shortCode>) y sus hijas (ig-<shortCode>-<slug>); el '_'/'%' del
    // shortCode se escapa (son comodines de LIKE — Postgres usa '\' como
    // escape por defecto sin necesidad de ESCAPE explícito).
    const escaparLike = (s) => String(s).replace(/[\\_%]/g, '\\$&')
    const patronesProcesables = procesables.map((item) => `ig-${escaparLike(item.shortCode)}%`)
    const actividadesPrevias = patronesProcesables.length
      ? await sql`
          SELECT origen_externo_id, titulo, imagen_url, imagen_origen_id
          FROM actividades
          WHERE origen_externo_id LIKE ANY(${patronesProcesables}::text[])`
      : []

    for (const item of procesables) {
      const post = postsPorShortCode.get(item.shortCode)
      try {
        const prefijoPropio = `ig-${item.shortCode}`
        // Filas ya en Neon de ESTE post: la propia (fila única) y sus hijas.
        const relacionadas = actividadesPrevias.filter(
          (e) => e.origen_externo_id === prefijoPropio || e.origen_externo_id.startsWith(`${prefijoPropio}-`)
        )
        // Hermanas (solo hijas, sin la fila única) — la usa idDeHija más abajo.
        const hermanas = relacionadas.filter((e) => e.origen_externo_id !== prefijoPropio)

        // La foto del post, ya en Blob, como imagen de la fila única y
        // fallback de las extraídas (la URL cruda del CDN de Instagram
        // caduca en días). El blob es el mismo para cualquier fila de este
        // post (mismo shortCode), así que basta con que UNA relacionada ya
        // tenga imagen para reutilizarla sin volver a descargar ni subir.
        const imagenPostExistente = relacionadas.find((e) => e.imagen_url)?.imagen_url || null
        let imagenPost
        if (imagenPostExistente) {
          imagenPost = imagenPostExistente
          resumen.imagenesReutilizadas++
        } else {
          imagenPost = await subirImagen('instagram-actividades', item.shortCode, item.imagenOrigen)
          if (imagenPost) resumen.imagenesSubidas++
        }

        const url = detectarUrl(post.caption)
        let extraccion = { eventos: [], actividades: [] }
        if (url && (item.programaEnlazada || item.tipo === 'actividad')) {
          const doc = await descargarDocumento(url)
          extraccion = await extraerDeDocumento(doc, url, imagenPost, item.shortCode)
        }

        // Sin documento (o sin resultados) y con carrusel de carteles: una
        // actividad por cartel a partir del alt de cada foto — la programación
        // deportiva viaja así (un cartel por prueba, con plazo y lugar en el
        // OCR), y el alt del post padre no dice nada. Nacen borrador, como
        // todo lo extraído en masa.
        let hijasCarrusel = []
        if (
          !extraccion.actividades.length &&
          item.tipo === 'actividad' &&
          (post.carrusel?.length || 0) >= 2
        ) {
          hijasCarrusel = await extraerDeCarrusel(
            post.carrusel.slice(0, MAX_IMAGENES_POST),
            item.publicadoEn
          )
          // La foto del cartel correspondiente, a Blob con sufijo por índice
          // — salvo que ya exista una hermana con esa misma foto y con
          // imagen: entonces se reutiliza la suya en vez de volver a
          // descargarla y subirla (ver hermanaDe() más arriba).
          for (const h of hijasCarrusel) {
            const fotoId = post.carrusel[h.indice]?.id || null
            const gemela = hermanaDe(hermanas, { imagenOrigenId: fotoId, titulo: h.titulo })
            if (gemela?.imagen_url) {
              h.imagen_url = gemela.imagen_url
              h.imagenOrigenId = gemela.imagen_origen_id || fotoId
              resumen.imagenesReutilizadas++
              continue
            }
            const subida = await subirImagen(
              'instagram-actividades',
              item.shortCode,
              post.carrusel[h.indice]?.imagen,
              `c${h.indice}`
            )
            if (subida) resumen.imagenesSubidas++
            h.imagen_url = subida || imagenPost
            h.imagenOrigenId = fotoId
          }
        }

        // Guarda de la fila única: si este MISMO post ya creó un evento de
        // agenda (webhook de eventos), la "actividad" del triaje es casi
        // seguro el mismo acto mal clasificado (p. ej. el cine de verano) —
        // no se duplica en /actividades.
        const hijas = extraccion.actividades.length ? extraccion.actividades : hijasCarrusel
        let crearFilaUnica = !hijas.length && item.tipo === 'actividad'
        if (crearFilaUnica) {
          const yaEvento = await sql`
            SELECT 1 FROM eventos_usuario
            WHERE origen_externo_id = ${`ig-${item.shortCode}`} LIMIT 1`
          if (yaEvento.length) {
            resumen.omitidasPorSerEvento = (resumen.omitidasPorSerEvento || 0) + 1
            crearFilaUnica = false
          }
        }

        // Reutiliza el origen_externo_id de una hermana ya existente (mismo
        // criterio que hermanaDe(): id de foto primero, título como
        // fallback — ver el comentario de más arriba). El upsert actualiza
        // esa fila (respetando su estado) en vez de crear una
        // casi-duplicada. Esto era antes solo por título: la deriva de
        // títulos entre extracciones ("…con DJ" vs "…con DJ Piwi") cambiaba
        // el slug y re-proponía como borrador actividades ya aprobadas —
        // pero un título parecido de OTRA actividad real ("Torneo de Pádel"
        // / "Torneo de Pádel Infantil") también podía emparejar mal y hacer
        // que el upsert sobreescribiera una fila con los datos de otra. Con
        // id de foto disponible (hijas de carrusel), la identidad ya no
        // depende de cómo Claude redacte el título esta vez.
        const idDeHija = (h, usados) => {
          const gemela = hermanaDe(hermanas, h)
          if (gemela) {
            usados.add(gemela.origen_externo_id.slice(`ig-${item.shortCode}-`.length))
            return gemela.origen_externo_id
          }
          // Bug B fix: usar imagen_origen_id como identidad estable si está disponible.
          // Caso galerías (mayoría): foto estable = id estable (no depende de cómo Claude redacta).
          if (h.imagenOrigenId) {
            return `ig-${item.shortCode}-img-${h.imagenOrigenId}`
          }
          // Fallback (caso minoritario, sin imagen): posición ordinal en el candidato.
          // La posición la asigna la página/Claude, no cambia entre runs.
          const sufijo = `posicion-${Array.from(usados).filter((s) => s.startsWith('posicion-')).length}`
          usados.add(sufijo)
          return `ig-${item.shortCode}-${sufijo}`
        }

        // — Actividades: hijas del documento o del carrusel (borrador) o, en
        //   su defecto, la del propio triaje (publicado directo, flujo rodado).
        const slugsActividades = new Set()
        const filasActividades = hijas.length
          ? hijas.map((h) => ({
              origenId: idDeHija(h, slugsActividades),
              titulo: h.titulo,
              categoria: h.categoria || item.categoria || 'general',
              fechaEvento: h.fechaEvento || item.fechaEvento || null,
              fechaLimite: h.fechaLimite || item.fechaLimite,
              horario: h.horario,
              lugar: h.lugar,
              // La extracción por visión del carrusel trae los datos
              // prácticos del cartel (edades, precio, cómo inscribirse).
              descripcion: h.descripcion || null,
              imagenUrl: h.imagen_url || imagenPost,
              // Solo las hijas de un carrusel traen id de foto (ver arriba);
              // las de un documento (PDF/HTML) van a NULL.
              imagenOrigenId: h.imagenOrigenId || null,
              estado: 'borrador',
            }))
          : crearFilaUnica
            ? [
                {
                  origenId: `ig-${item.shortCode}`,
                  titulo: item.titulo,
                  categoria: item.categoria || 'general',
                  fechaEvento: item.fechaEvento || null,
                  fechaLimite: item.fechaLimite,
                  horario: null,
                  lugar: null,
                  descripcion: item.resumen || null,
                  imagenUrl: imagenPost,
                  imagenOrigenId: null,
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
                (origen_externo_id, titulo, descripcion, categoria, fecha_evento, fecha_limite, horario,
                 lugar, imagen_url, imagen_origen_id, url_fuente, estado, publicado_en)
              VALUES
                (${fila.origenId}, ${fila.titulo}, ${fila.descripcion}, ${fila.categoria},
                 ${fila.fechaEvento}, ${fila.fechaLimite}, ${fila.horario}, ${fila.lugar}, ${fila.imagenUrl},
                 ${fila.imagenOrigenId}, ${url || post.url}, ${fila.estado}, ${item.publicadoEn})
              ON CONFLICT (origen_externo_id)
              DO UPDATE SET
                titulo = EXCLUDED.titulo,
                descripcion = EXCLUDED.descripcion,
                categoria = EXCLUDED.categoria,
                fecha_evento = EXCLUDED.fecha_evento,
                fecha_limite = EXCLUDED.fecha_limite,
                horario = EXCLUDED.horario,
                lugar = EXCLUDED.lugar,
                imagen_url = COALESCE(EXCLUDED.imagen_url, actividades.imagen_url),
                imagen_origen_id = COALESCE(EXCLUDED.imagen_origen_id, actividades.imagen_origen_id),
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
          const slugsEventos = new Set()
          for (const ev of extraccion.eventos) {
            const origenId = `ig-${item.shortCode}-${sufijoDe(ev.titulo, slugsEventos)}`
            try {
              const clave = claveTitulo(ev.titulo)
              const gemelo = existentes.find(
                (e) =>
                  e.fecha === ev.fecha &&
                  e.origen_externo_id !== origenId &&
                  titulosEquivalentes(claveTitulo(e.titulo), clave)
              )
              if (gemelo) {
                eventosDocDuplicados++
                continue
              }

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

  // Log de la ejecución (tabla ingesta_log, solo observabilidad — nunca
  // lanza). candidatos son POSTS y nuevos/emparejados son FILAS (noticias,
  // actividades y eventos de documento sumados): no tienen por qué cuadrar.
  await registrarIngesta({
    fuente: 'sync-instagram-noticias',
    candidatos: resumen.recibidos,
    emparejados: resumen.actualizadas,
    nuevos: resumen.creadas,
    motivos: {
      'post no normalizable': noNormalizables,
      'antigüedad (>30 días) o tope de posts': resumen.descartadosPorAntiguedad,
      'irrelevante (rechazo del triaje del modelo)': Math.max(0, resumen.analizados - extraidasTotal),
      'validación de la extracción': resumen.descartadasPorValidacion,
      'ya existía como evento de agenda': resumen.omitidasPorSerEvento || 0,
      'duplicado de evento existente (documento)': eventosDocDuplicados,
    },
  })
}
