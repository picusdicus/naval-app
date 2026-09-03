// POST /api/sync-instagram — webhook de Apify: convierte posts de Instagram de
// cultura_navalcarnero (y de ayuntamientonavalcarnero, cuya task de noticias
// también apunta aquí con un segundo webhook) en eventos de la agenda.
//
// Flujo: Apify termina su ejecución semanal → llama aquí → se identifican con
// Claude los posts que anuncian un evento real (fecha y lugar en el caption o
// en el cartel; la hora es opcional) → la imagen del post se sube a Vercel
// Blob (las URLs del CDN de Instagram caducan) → upsert en eventos_usuario
// bajo la organización que corresponde al autor del post (ORG_POR_USUARIO),
// en estado 'publicado'.
//
// Integración con el resto del sistema, sin tocar el cron diario:
// - GET /api/eventos ya emite estos eventos con origen 'cultural' y la
//   organización como fuente/"Organiza" (p. ej. 'Cultura Navalcarnero' para
//   los posts de cultura_navalcarnero — la fuente es el nombre del JOIN).
// - El digest push diario (api/sync-events.js) los anuncia solo: entran como
//   filas publicadas futuras con notificado_en NULL.
// - El upsert usa eventos_usuario.origen_externo_id (índice único parcial):
//   'ig-<shortCode>' para el caso normal de un evento por post, e
//   'ig-<shortCode>-<slug>' para cada evento extra de un carrusel multi-evento
//   (esos nacen 'borrador' y se validan en /admin → Pendientes — ver
//   asignarIdentidades). Re-ejecutar el webhook actualiza en vez de duplicar,
//   y una edición no re-notifica (notificado_en no se toca en el UPDATE). El
//   estado tampoco: un evento archivado a mano por el superadmin no resucita,
//   y un borrador ya publicado no vuelve a borrador.
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
  carruselDe,
  esAltGenerico,
  esPostReciente,
  normalizarPost,
  obtenerPosts,
  orgDeUsuario,
  subirImagen,
} from './_instagram.js'
import { SUBCATEGORIAS_CULTURA } from '../src/lib/eventos.js'
import { claveTitulo, titulosEquivalentes } from '../src/lib/dedupEventos.js'
import { registrarIngesta } from './_ingesta-log.js'
import { enviarEmailPendientes } from './_email.js'

// Modelo AISLADO de ANTHROPIC_MODEL a propósito, igual que
// ANTHROPIC_MODEL_DEPORTES_VISION. Esta extracción lee carteles rotulados —
// mandando ~60 imágenes por ejecución— y no es lo mismo que el triaje de texto
// de los webhooks, que es para lo que se puso Haiku en ANTHROPIC_MODEL. Con la
// variable compartida, un cambio pensado para los webhooks degradaba esto en
// silencio (es lo que le pasó a la visión de deportes en agosto).
//
// Se eligió por CALIDAD, no por precio, midiendo los tres sobre el dataset
// real del 3-sep (15 posts) con las imágenes ya reducidas, dos ejecuciones
// cada uno:
//
//   opus-5     los 2 eventos reales, IDÉNTICOS en ambas ejecuciones, 0 falsos
//              positivos.  ~$0.33/run, ~$122/año con el cron diario.
//   haiku-4-5  12 eventos en una ejecución y 4 en la otra con la MISMA
//              entrada, y publica crónicas de actos ya celebrados como si
//              fueran eventos futuros.  ~$28/año.
//   sonnet-5   pierde la Feria en las dos, y cuesta el doble que Haiku.
//
// Los falsos positivos de Haiku no son inocuos: un post de un solo evento nace
// 'publicado' y NO pasa por Pendientes, así que una crónica de ayer aparece
// sola en la agenda.
export const MODEL = process.env.ANTHROPIC_MODEL_INSTAGRAM_EVENTOS || 'claude-opus-5'

// Misma taxonomía que eventos.json / la UI de la agenda.
const CATEGORIAS = ['cultura', 'deporte', 'fiestas', 'gastronomia', 'infantil', 'mercado']

// Subcategorías DENTRO de cultura (teatro, cine, …): afinan los filtros de la
// agenda sin trocear la categoría paraguas (los temas de push 'cat:cultura' y
// el perfil de las orgs no se tocan). Whitelist compartida con la UI.
const SUBCATEGORIAS = Object.keys(SUBCATEGORIAS_CULTURA)

// Un acto puede no tener hora de inicio (una feria abierta todo el día, un
// mercado): la hora es opcional y se guarda NULL, la fecha y el lugar no.
const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/

// Constantes de posts e imágenes, helpers de Apify/Blob y la atribución por
// autor (ORG_POR_USUARIO → orgDeUsuario/asegurarOrganizacion) compartidos con
// el webhook de noticias: en api/_instagram.js.

// El json_schema fuerza la forma de la respuesta; los VALORES se validan
// aparte en validarExtraccion() — nunca se confía en la salida del modelo.
const ESQUEMA_EXTRACCION = {
  type: 'object',
  additionalProperties: false,
  required: ['eventos'],
  properties: {
    eventos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['shortCode', 'titulo', 'fecha', 'lugar', 'categoria', 'subcategoria', 'descripcion'],
        properties: {
          shortCode: { type: 'string' },
          titulo: { type: 'string' },
          fecha: { type: 'string' },
          hora: { type: ['string', 'null'] },
          lugar: { type: 'string' },
          categoria: { enum: CATEGORIAS },
          // '' = sin subcategoría (no es cultura, o no está clara).
          subcategoria: { enum: [...SUBCATEGORIAS, ''] },
          descripcion: { type: 'string' },
          // Índice de la foto del carrusel si los datos vienen de una hija específica marcada [Imagen N]
          indiceCartel: { type: ['integer', 'null'] },
        },
      },
    },
  },
}

const INSTRUCCIONES = `Analiza posts de Instagram de cuentas municipales de Navalcarnero (Madrid) — la concejalía de cultura y el Ayuntamiento — e identifica cuáles anuncian un EVENTO REAL al que un vecino puede asistir.

Un post es un evento SOLO si menciona explícitamente una fecha concreta y un lugar. La hora es deseable pero NO obligatoria: hay actos sin hora de inicio (una feria abierta todo el día, un mercado, una exposición). Estos datos pueden aparecer en el caption o en el texto del cartel (campo "alt", la descripción automática de la imagen) — es habitual que el caption sea solo la sinopsis y los datos prácticos estén en el cartel.

Además, un evento de agenda es un ACTO al que el vecino asiste como público o participante: una función, un concierto, una proyección, una fiesta, un mercado, una feria, una carrera popular, un encierro. Puede ser puntual o durar varios días seguidos y estar abierto todo el día (una feria de atracciones, un mercado medieval, una exposición temporal): lo que cuenta es que sea algo a lo que se va y que empiece y termine en fechas concretas. Tener fecha, hora y lugar NO basta. Descarta aunque los tengan:
- Aperturas de plazos de inscripción y bases de concursos (cursos de natación, talleres, campamentos).
- Campañas y servicios: donaciones de sangre, sorteos comerciales, custodia de llaves, objetos perdidos.
- El horario de servicio de una instalación permanente o de una temporada entera: la piscina municipal abre de 11 a 21 h en verano, el horario de la biblioteca, el del polideportivo. La diferencia con el punto anterior es que aquí NO hay un acto que empiece y acabe, solo las horas a las que abre algo que ya existía.
- Noticias, agradecimientos, balances y comunicados.
- Actos fuera de Navalcarnero.

Para cada evento devuelve:
- shortCode: el del post, copiado tal cual.
- titulo: corto y legible en español (sin mayúsculas gritadas).
- fecha: YYYY-MM-DD. Resuelve fechas relativas ("este sábado 18") con el campo "publicado" del post. Si el evento dura varios días, usa el día de inicio.
- hora: HH:MM en formato 24 h, o null si el acto no tiene hora específica (ferris, stands, zonas de ocio continuadas todo el día).
- lugar: el nombre del sitio tal como aparece (sin ", Navalcarnero").
- categoria: la más apropiada de la lista permitida.
- subcategoria: SOLO si categoria es "cultura", el tipo concreto de acto: "teatro", "cine", "musica" (conciertos, recitales), "danza", "exposicion", u "otros" si es cultural pero no encaja en ninguno. Para cualquier otra categoria, "".
- descripcion: el caption limpio de hashtags y menciones, máximo 400 caracteres.
- indiceCartel: null normalmente. SOLO si los datos del evento (fecha, hora, lugar, descripción) provienen explícitamente del alt de un cartel específico marcado como "[Imagen N]" (donde N es 1, 2, 3…), devuelve N-1 (es decir, el índice: 0 para [Imagen 1], 1 para [Imagen 2], etc.). Si provienen del caption general del post o es ambiguo, deja null.

Si el post incluye imágenes numeradas [Imagen 1], [Imagen 2], etc., cada una es una foto del carrusel con su propio cartel. Usa el contenido de las imágenes (no solo el alt, que puede ser genérico) para extraer datos cuando sea necesario. Los carteles suelen llevar el título, fecha, hora y lugar rotulados en la foto.

Devuelve solo los posts que son eventos; si ninguno lo es, devuelve la lista vacía.`

// En lotes por el mismo motivo que el triaje de noticias: la respuesta de un
// run entero (50 posts) puede superar max_tokens y llegar truncada — el
// JSON.parse del texto cortado tumbaba el run completo.
const LOTE_TRIAJE = 10

// Tope de imágenes que viajan en UNA petición de extracción. La API rechaza
// la petición entera por encima de 100 imágenes, y un lote de 10 posts con
// carruseles de hasta MAX_FOTOS_ALT (10) fotos llegaría a 110 — el error se
// come el lote completo y sus eventos. 40 cubre de sobra los carruseles
// municipales reales sin acercarse al límite.
const MAX_IMAGENES_VISION = 40

// Un fetch sin señal no vence nunca: una conexión colgada del CDN de
// Instagram dejaría el run entero esperando hasta que la función muera.
const TIMEOUT_IMAGEN_MS = 10000

// En una petición con VARIAS imágenes, la API rechaza la petición entera con
// un 400 si alguna pasa de 2000 px de lado. No degrada: se pierden todos los
// posts del lote, no solo el de la foto grande. Pasó de verdad el 3-sep-2026
// con un post de 2016x1133 —16 px de más— que se llevó por delante los 10
// posts de su lote, entre ellos la Matiné y la Feria, en todas las
// ejecuciones. Apify ya da las dimensiones, así que la foto se descarta aquí
// sin llegar a descargarla.
const MAX_LADO_IMAGEN = 2000

// Descargas en tandas y no todas a la vez, mismo criterio que la visión de los
// carteles de deportes: no ametrallar al CDN.
const CONCURRENCIA_IMAGENES = 5

// Las imágenes se facturan por (ancho x alto) / 750 tokens, así que su tamaño
// es LA palanca de coste de esta extracción: son el 99 % de la entrada.
// Medido sobre el dataset real del 3-sep, con Opus 5 y el run completo:
//
//   sin reducir  108k tokens  ~$209/año     600 px   48k  ~$100/año
//   1000 px       76k tokens  ~$150/año     800 px   61k  ~$122/año
//
// 800 px porque Opus extrae los mismos 2 eventos, idénticos, a 1000, 800 y
// 600: la calidad no se resiente en ese tramo. No se baja a 600 porque solo
// ahorra $22/año más y estos carteles llevan la fecha y la hora en letra
// pequeña — el margen de legibilidad vale más que eso, sobre todo para
// carteles más densos que los dos que hoy se extraen.
const MAX_LADO_VISION = 800

let sharpCargado
/** sharp, cargado una sola vez y de forma perezosa. null si no está. */
async function obtenerSharp() {
  if (sharpCargado === undefined) {
    try {
      sharpCargado = (await import('sharp')).default
    } catch (err) {
      console.warn(`sharp no disponible, las imágenes van sin reducir: ${err.message}`)
      sharpCargado = null
    }
  }
  return sharpCargado
}

/** Descarga una imagen, la reduce y la devuelve como bloque `image` base64.
 *  Nunca lanza: un fallo devuelve null y la extracción sigue sin esa foto. */
async function descargarImagenBase64(foto) {
  const { url, lado = 0 } = foto
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_IMAGEN_MS) })
    if (!res.ok) return null
    let datos = Buffer.from(await res.arrayBuffer())
    let tipo = res.headers.get('content-type') || 'image/jpeg'

    const sharp = await obtenerSharp()
    if (sharp) {
      try {
        datos = await sharp(datos)
          .resize({ width: MAX_LADO_VISION, height: MAX_LADO_VISION, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer()
        tipo = 'image/jpeg'
      } catch (err) {
        // Si no se pudo reducir, una foto que pase del tope de la API no puede
        // mandarse: tumbaría la petición entera del lote (ver MAX_LADO_IMAGEN).
        console.warn(`No se pudo reducir ${url}: ${err.message}`)
        if (lado > MAX_LADO_IMAGEN) return null
      }
    } else if (lado > MAX_LADO_IMAGEN) {
      return null
    }

    return {
      type: 'image',
      source: { type: 'base64', media_type: tipo, data: datos.toString('base64') },
    }
  } catch (err) {
    console.warn(`No se pudo descargar la imagen ${url}: ${err.message}`)
    return null
  }
}

async function enTandas(items, limite, fn) {
  const salida = []
  for (let i = 0; i < items.length; i += limite) {
    salida.push(...(await Promise.all(items.slice(i, i + limite).map(fn))))
  }
  return salida
}

export /** Una petición de extracción: valida el motivo de parada y parsea la salida. */
async function pedirExtraccion(client, contenido, postsEnLote) {
  const respuesta = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: [{ type: 'text', text: INSTRUCCIONES, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_EXTRACCION } },
    messages: [{ role: 'user', content: contenido }],
  })
  if (respuesta.stop_reason === 'refusal') {
    throw new Error('el modelo rechazó la petición de extracción')
  }
  if (respuesta.stop_reason === 'max_tokens') {
    throw new Error(`respuesta truncada por max_tokens (${postsEnLote} posts en el lote)`)
  }
  const texto = respuesta.content.find((b) => b.type === 'text')?.text || '{"eventos":[]}'
  return { eventos: JSON.parse(texto).eventos || [], uso: respuesta.usage }
}

export async function extraerEventos(posts) {
  const client = new Anthropic()
  const lotes = []
  for (let i = 0; i < posts.length; i += LOTE_TRIAJE) {
    lotes.push(posts.slice(i, i + LOTE_TRIAJE))
  }
  // Lotes en paralelo: el tiempo total pasa a ser ~el de un lote.
  const resultados = await Promise.all(
    lotes.map(async (lote, idx) => {
      try {
        // Construir payload de contenido: texto + imágenes si alt es genérico
        const contenido = []

        // 1. Bloque de texto con datos de los posts en JSON
        contenido.push({
          type: 'text',
          text: JSON.stringify(lote),
        })

        // 2. Imágenes solo si el alt del post (o el de alguna hija del
        // carrusel) es genérico. Se descargan y viajan en base64: las URLs del
        // CDN de Instagram van firmadas y la API no puede ir a buscarlas.
        //
        // Se recogen primero todas las URLs y se descargan después, en tandas:
        // en serie, una foto lenta multiplicaba por el número de fotos el
        // tiempo del run.
        // Ya NO se descarta aquí la foto que pasa del tope de la API: al
        // reducirlas a MAX_LADO_VISION todas caben, así que un cartel grande
        // se aprovecha en vez de perderse. `lado` viaja para poder decidir si
        // la reducción falla (ver descargarImagenBase64).
        const fotos = []
        for (const post of lote) {
          const hijasGenéricas = (post.carrusel || []).filter(
            (c) => c.imagen && esAltGenerico(c.alt)
          )
          if (!esAltGenerico(post.alt) && hijasGenéricas.length === 0) continue
          if (post.imagen) fotos.push({ url: post.imagen, lado: post.lado })
          for (const c of hijasGenéricas) fotos.push({ url: c.imagen, lado: c.lado })
        }
        const imagenes = await enTandas(
          fotos.slice(0, MAX_IMAGENES_VISION),
          CONCURRENCIA_IMAGENES,
          descargarImagenBase64
        )
        contenido.push(...imagenes.filter(Boolean))

        try {
          const { eventos: items, uso } = await pedirExtraccion(client, contenido, lote.length)
          return { items, uso }
        } catch (err) {
          // Red de seguridad: cualquier fallo atribuible a las imágenes (un
          // tamaño que no veníamos venir, un formato raro) tumbaría los 10
          // posts del lote. Antes de darlos por perdidos se reintenta con solo
          // el texto, que es como funcionaba esto antes de la visión: se pierde
          // la lectura de los carteles del lote, no los posts.
          const soloTexto = contenido.filter((b) => b.type !== 'image')
          if (soloTexto.length === contenido.length) throw err
          console.warn(`Lote ${idx + 1}: reintento sin imágenes tras "${err.message}"`)
          const { eventos: items, uso } = await pedirExtraccion(client, soloTexto, lote.length)
          return { items, uso, degradados: lote.length, causaDegradado: err.message }
        }
      } catch (err) {
        // `fallidos` = posts que el modelo NUNCA llegó a evaluar. Sin este
        // dato sus posts se contaban como "no es evento (rechazo del triaje)",
        // que es justo lo contrario de lo que pasó y manda la investigación en
        // la dirección equivocada.
        return { error: `Extracción lote ${idx + 1}: ${err.message}`, fallidos: lote.length }
      }
    })
  )
  const eventos = []
  const errores = []
  let postsNoEvaluados = 0
  // Motivos para ingesta_log: la CAUSA como clave y los POSTS afectados como
  // valor (misma unidad que el resto de motivos del log, que cuentan posts).
  const fallosPorCausa = {}
  // Tokens de todas las peticiones del run: lo consume el script de
  // diagnóstico para medir el coste real por modelo.
  const uso = { entrada: 0, salida: 0, cacheEscrito: 0, cacheLeido: 0 }
  for (const r of resultados) {
    if (r.uso) {
      uso.entrada += r.uso.input_tokens || 0
      uso.salida += r.uso.output_tokens || 0
      uso.cacheEscrito += r.uso.cache_creation_input_tokens || 0
      uso.cacheLeido += r.uso.cache_read_input_tokens || 0
    }
  }
  for (const r of resultados) {
    if (r.error) {
      errores.push(r.error)
      postsNoEvaluados += r.fallidos || 0
      const causa = r.error.replace(/^Extracción lote \d+: /, '').slice(0, 80)
      const clave = `lote de extracción con error: ${causa}`
      fallosPorCausa[clave] = (fallosPorCausa[clave] || 0) + (r.fallidos || 0)
      continue
    }
    eventos.push(...r.items)
    if (r.degradados) {
      // El lote salió adelante, pero sin leer sus carteles: no es un descarte,
      // es una pérdida de calidad que conviene ver en el log para arreglarla.
      const clave = `lote reintentado SIN imágenes: ${String(r.causaDegradado).slice(0, 80)}`
      fallosPorCausa[clave] = (fallosPorCausa[clave] || 0) + r.degradados
    }
  }
  return { eventos, errores, postsNoEvaluados, fallosPorCausa, uso }
}

/** Exportada, como validarExtraccion, SOLO para verificación/diagnóstico.
 *  Valida los valores extraídos contra los posts realmente enviados. */
export function validarExtraccion(eventos, postsPorShortCode) {
  const validos = []
  const descartados = []
  // Dedup DENTRO de la respuesta del modelo. Antes la clave era el shortCode
  // a secas (un evento por post): en un carrusel multi-evento (la programación
  // deportiva de agosto 2026: 10 carteles, 5-6 extracciones) sobrevivía una y
  // el resto se tiraba como "validación de la extracción". Ahora la clave es
  // post+fecha+título normalizado, así que solo cae la repetición literal;
  // cuántas filas emite un post y con qué id/estado se decide después, en
  // asignarIdentidades().
  const vistos = new Set()
  for (const ev of Array.isArray(eventos) ? eventos : []) {
    const post = postsPorShortCode.get(ev.shortCode)
    const valido =
      post &&
      typeof ev.titulo === 'string' &&
      ev.titulo.trim() &&
      /^\d{4}-\d{2}-\d{2}$/.test(ev.fecha) &&
      (ev.hora == null || ev.hora === '' || HORA_VALIDA.test(ev.hora)) &&
      typeof ev.lugar === 'string' &&
      ev.lugar.trim() &&
      CATEGORIAS.includes(ev.categoria)
    if (!valido) {
      descartados.push(ev.shortCode || '(sin shortCode)')
      continue
    }
    const clave = `${ev.shortCode}|${ev.fecha}|${claveTitulo(ev.titulo)}`
    if (vistos.has(clave)) {
      descartados.push(ev.shortCode)
      continue
    }
    vistos.add(clave)
    validos.push({
      shortCode: ev.shortCode,
      titulo: ev.titulo.trim().slice(0, 200),
      fecha: ev.fecha,
      hora: HORA_VALIDA.test(ev.hora) ? ev.hora : null,
      lugar: ev.lugar.trim().slice(0, 120),
      categoria: ev.categoria,
      // Solo tiene sentido bajo cultura; fuera de la whitelist queda NULL (un
      // evento sin subcategoría clara simplemente no entra en los sub-filtros).
      subcategoria:
        ev.categoria === 'cultura' && SUBCATEGORIAS.includes(ev.subcategoria)
          ? ev.subcategoria
          : null,
      descripcion: String(ev.descripcion || '').trim().slice(0, 1000),
      url: post.url,
      imagenOrigen: post.imagen,
      usuario: post.usuario,
      indiceCartel: typeof ev.indiceCartel === 'number' && ev.indiceCartel >= 0 ? ev.indiceCartel : null,
      // Las fotos del carrusel viajan CON el evento validado: la rama que
      // elige el cartel concreto (indiceCartel) vive en el bucle de upsert,
      // donde la variable `post` de este scope no existe — referenciarla allí
      // era un ReferenceError latente que se llevaba el evento por delante.
      carrusel: post.carrusel || [],
    })
  }
  return { validos, descartados }
}

/** Sufijo estable por título para ids de hijas, mismo patrón que el webhook
 * de noticias: con índices numéricos el orden de extracción cambia entre runs
 * y el upsert machacaría una fila con el contenido de otra. Colisiones dentro
 * del mismo post se numeran (-2, -3…). */
function sufijoDe(titulo, usados) {
  const base = claveTitulo(titulo).replace(/ /g, '-').slice(0, 48).replace(/-+$/, '') || 'evento'
  let slug = base
  for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`
  usados.add(slug)
  return slug
}

/**
 * Decide el origen_externo_id y el estado inicial de cada evento validado
 * (los deja en ev.origenId / ev.estado).
 *
 * - Post con UN evento (el caso normal): ig-<shortCode> y 'publicado', el
 *   comportamiento de siempre.
 * - Post con VARIOS eventos (carrusel multi-evento): cada uno lleva id propio
 *   ig-<shortCode>-<slug del título> y nace 'borrador' — una extracción
 *   masiva de un carrusel es menos fiable que la de un caption, así que pasa
 *   por la validación humana de /admin → Pendientes, como las hijas de
 *   documento del webhook de noticias. El digest push no los anuncia hasta
 *   que el superadmin los publique (publicar deja notificado_en NULL, así que
 *   entran en el siguiente digest como cualquier otro).
 * - Si ya existe una fila del MISMO post con título equivalente (la fila
 *   única histórica ig-<shortCode> o una hija de un run anterior cuyo título
 *   derivó), se reutiliza su id: el upsert actualiza esa fila respetando su
 *   estado en vez de crear una casi-duplicada. Emparejar por título comparte
 *   el riesgo de colisión ya documentado en el webhook de noticias
 *   (idDeHija); aquí no hay imagen_origen_id que lo mitigue.
 */
async function asignarIdentidades(sql, validos) {
  const porPost = new Map()
  for (const ev of validos) {
    if (!porPost.has(ev.shortCode)) porPost.set(ev.shortCode, [])
    porPost.get(ev.shortCode).push(ev)
  }

  const multiples = [...porPost.entries()].filter(([, grupo]) => grupo.length > 1)

  // Filas ya existentes de los posts multi-evento (la única histórica y las
  // hijas), para reutilizar ids. El '_'/'%' del shortCode se escapa (son
  // comodines de LIKE).
  const escaparLike = (s) => String(s).replace(/[\\_%]/g, '\\$&')
  const patrones = multiples.flatMap(([sc]) => [`ig-${escaparLike(sc)}`, `ig-${escaparLike(sc)}-%`])
  const familiares = patrones.length
    ? await sql`
        SELECT origen_externo_id, titulo
        FROM eventos_usuario
        WHERE origen_externo_id LIKE ANY(${patrones}::text[])`
    : []

  for (const [shortCode, grupo] of porPost.entries()) {
    if (grupo.length === 1) {
      grupo[0].origenId = `ig-${shortCode}`
      grupo[0].estado = 'publicado'
      continue
    }
    const prefijo = `ig-${shortCode}`
    const delPost = familiares.filter(
      (f) => f.origen_externo_id === prefijo || f.origen_externo_id.startsWith(`${prefijo}-`)
    )
    const idsUsados = new Set()
    const slugsUsados = new Set(
      delPost
        .filter((f) => f.origen_externo_id.startsWith(`${prefijo}-`))
        .map((f) => f.origen_externo_id.slice(prefijo.length + 1))
    )
    for (const ev of grupo) {
      const clave = claveTitulo(ev.titulo)
      const previa = delPost.find(
        (f) =>
          !idsUsados.has(f.origen_externo_id) &&
          titulosEquivalentes(claveTitulo(f.titulo), clave)
      )
      ev.origenId = previa
        ? previa.origen_externo_id
        : `${prefijo}-${sufijoDe(ev.titulo, slugsUsados)}`
      idsUsados.add(ev.origenId)
      ev.estado = 'borrador'
    }
  }
}

/** Columna e índice del upsert, idempotentes (también están en db/schema.sql). */
async function asegurarColumnaOrigen(sql) {
  await sql`ALTER TABLE eventos_usuario ADD COLUMN IF NOT EXISTS origen_externo_id text`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_origen_externo
            ON eventos_usuario (origen_externo_id) WHERE origen_externo_id IS NOT NULL`
  await sql`ALTER TABLE eventos_usuario ADD COLUMN IF NOT EXISTS subcategoria text`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Usa POST.' })
    return
  }

  // Igual que el cron: Bearer en tiempo constante y fallar cerrado sin la env.
  // Se acepta también ?secret= porque la config de webhooks de Apify hace más
  // sencillo añadir un query param a la URL que una cabecera.
  const cabecera = req.headers['authorization'] || ''
  const secreto = process.env.INSTAGRAM_SYNC_SECRET
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
    eventos: 0,
    creados: 0,
    creadosEnBorrador: 0,
    actualizados: 0,
    duplicadosOmitidos: 0,
    descartadosPorValidacion: 0,
    // Posts de un lote que falló: el modelo ni llegó a verlos. Inicializado
    // aquí porque el registrarIngesta del final resta este valor, y con
    // undefined la cuenta saldría NaN.
    postsNoEvaluados: 0,
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
        fuente: 'sync-instagram',
        candidatos: resumen.recibidos,
        motivos: {
          'post no normalizable': noNormalizables,
          'antigüedad (>30 días) o tope de posts': resumen.descartadosPorAntiguedad,
        },
      })
      res.status(200).json(resumen)
      return
    }

    // ACK inmediato (202): Apify corta el dispatch a los ~120 s y lo
    // reintenta entero — el triaje con Opus supera ese margen en runs densos.
    // El procesado sigue en segundo plano (waitUntil, Fluid); el resumen
    // final queda en los logs de la función.
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
    console.error('Error en sync-instagram:', err)
    resumen.errores.push(err.message)
    if (!res.headersSent) res.status(500).json(resumen)
  }
}

/** Todo el trabajo pesado, ya sin una respuesta HTTP que mantener abierta. */
async function procesar(posts, resumen, noNormalizables = 0) {
  // Cuántas extracciones devolvió el modelo: lo que falte hasta `analizados`
  // son posts que el triaje consideró que no anuncian un evento.
  let extraidosTotal = 0
  // Borradores REALMENTE insertados este run (no actualizados): son los que
  // avisan por email al superadmin, mismo patrón que el webhook de noticias.
  const pendientesEventos = []
  // Contar motivosVisión: diferencia entre extracciones sin visión (alt útil)
  // y con visión (alt genérico) — observabilidad de la ingesta.
  //
  // Declarado FUERA del try a propósito: lo lee el registrarIngesta del final,
  // que vive después del catch. Dentro del try quedaba fuera de su alcance y
  // el spread lanzaba un ReferenceError EN TODAS las ejecuciones, ya después
  // del catch — así que la promesa de procesar() se rechazaba dentro del
  // waitUntil y ninguna ejecución llegaba a escribir su fila en ingesta_log
  // (el webhook ya había respondido 202, así que Apify seguía viendo un éxito
  // y el fallo era invisible por los dos lados).
  // Fuera del try por el mismo motivo que motivosVisión: lo lee el
  // registrarIngesta del final, que vive después del catch.
  const motivosLote = {}
  const motivosVisión = {
    'extraccion sin visión (alt útil)': 0,
    'extraccion con visión (alt genérico)': 0,
    'extraccion con visión parcial (algunos alt genéricos en carrusel)': 0,
  }
  try {
    for (const post of posts) {
      const altPostGenérico = esAltGenerico(post.alt)
      const hijas = post.carrusel || []
      const carruselTieneGenerico = hijas.some((c) => esAltGenerico(c.alt))
      const carruselTieneUtil = hijas.some((c) => !esAltGenerico(c.alt))
      const hayGenerico = altPostGenérico || carruselTieneGenerico
      const hayUtil = !altPostGenérico || carruselTieneUtil

      if (!hayGenerico) {
        motivosVisión['extraccion sin visión (alt útil)']++
      } else if (hayUtil) {
        motivosVisión['extraccion con visión parcial (algunos alt genéricos en carrusel)']++
      } else {
        motivosVisión['extraccion con visión (alt genérico)']++
      }
    }

    const postsPorShortCode = new Map(posts.map((p) => [p.shortCode, p]))
    const {
      eventos: extraidos,
      errores: erroresTriaje,
      postsNoEvaluados,
      fallosPorCausa,
    } = await extraerEventos(
      posts.map(({ shortCode, caption, alt, publicado, carrusel }) => ({ shortCode, caption, alt, publicado, carrusel }))
    )
    resumen.errores.push(...erroresTriaje)
    resumen.postsNoEvaluados = postsNoEvaluados
    Object.assign(motivosLote, fallosPorCausa)
    extraidosTotal = extraidos.length
    const { validos, descartados } = validarExtraccion(extraidos, postsPorShortCode)
    resumen.eventos = validos.length
    resumen.descartadosPorValidacion = descartados.length
    if (descartados.length) {
      resumen.errores.push(`Extracciones descartadas por validación: ${descartados.join(', ')}`)
    }

    const sql = obtenerSql()
    await asegurarColumnaOrigen(sql)

    // id + estado inicial de cada evento (multi-evento por carrusel → hijas
    // en borrador; ver el comentario de asignarIdentidades).
    await asignarIdentidades(sql, validos)

    // Dedup servidor Neon↔Neon: el mismo acto anunciado en dos posts (o por
    // las dos cuentas) no debe crear dos filas — cada fila extra entra en el
    // digest push y ensucia el panel. Se cargan los eventos ya existentes en
    // las fechas candidatas y, si un candidato NUEVO (su origen_externo_id no
    // existe aún) equivale a uno de ellos (misma fecha + título equivalente,
    // mismos criterios que el dedup de la agenda), se omite. El upsert del
    // propio post (re-run del webhook) no se ve afectado. Los duplicados con
    // los eventos estáticos se siguen fusionando en cliente a propósito: ahí
    // la fila de Neon aporta la foto del cartel.
    const fechas = [...new Set(validos.map((v) => v.fecha))]
    const existentes = fechas.length
      ? await sql`
          SELECT origen_externo_id, titulo, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha
          FROM eventos_usuario
          WHERE fecha_inicio = ANY(${fechas}::date[])`
      : []

    // Imágenes ya subidas (cuota de Blob: cada put() cuenta como Advanced
    // Request — ver "Presupuesto de Vercel Blob" en CLAUDE.md). Una sola
    // consulta por origen_externo_id, antes del bucle: si la fila ya existe
    // con imagen, se reutiliza su URL sin volver a llamar a subirImagen. Solo
    // se sube si el post es nuevo o si una subida anterior dejó imagen_url a
    // NULL (reintento).
    const idsEventos = validos.map((v) => v.origenId)
    const imagenesPrevias = idsEventos.length
      ? await sql`
          SELECT origen_externo_id, imagen_url
          FROM eventos_usuario
          WHERE origen_externo_id = ANY(${idsEventos}::text[])`
      : []
    const imagenPorOrigenId = new Map(imagenesPrevias.map((f) => [f.origen_externo_id, f.imagen_url]))

    // Cache por ejecución: una organización se asegura una sola vez aunque
    // firme varios eventos.
    const orgIds = new Map()
    const organizacionDe = async (usuario) => {
      const org = orgDeUsuario(usuario)
      if (!orgIds.has(org.slug)) orgIds.set(org.slug, await asegurarOrganizacion(sql, org))
      return orgIds.get(org.slug)
    }

    for (const ev of validos) {
      try {
        const origenId = ev.origenId
        const yaPropio = existentes.some((e) => e.origen_externo_id === origenId)
        if (!yaPropio) {
          const clave = claveTitulo(ev.titulo)
          const prefijoPost = `ig-${ev.shortCode}`
          const gemelo = existentes.find(
            (e) =>
              e.fecha === ev.fecha &&
              e.origen_externo_id !== origenId &&
              // Las filas del PROPIO post no cuentan como gemelo: la identidad
              // dentro del post ya la resolvió asignarIdentidades (reutilizando
              // ids por título equivalente), y dos hermanos de un carrusel con
              // títulos "equivalentes" por contención ("Torneo de fútbol" /
              // "Torneo de fútbol sala") suelen ser actos distintos — mejor
              // dejarlos pasar como borrador y que la validación humana decida.
              !(
                e.origen_externo_id === prefijoPost ||
                String(e.origen_externo_id || '').startsWith(`${prefijoPost}-`)
              ) &&
              titulosEquivalentes(claveTitulo(e.titulo), clave)
          )
          if (gemelo) {
            resumen.duplicadosOmitidos++
            continue
          }
        }

        const organizacionId = await organizacionDe(ev.usuario)

        // Cartel concreto del carrusel del que salió el evento (indiceCartel):
        // su foto se sube con sufijo -c<i> para no pisar el blob de la portada.
        const cartel =
          ev.indiceCartel !== null && ev.carrusel[ev.indiceCartel]?.imagen
            ? ev.carrusel[ev.indiceCartel]
            : null
        const sufijo = cartel ? `c${ev.indiceCartel}` : ''

        // Guard de cuota de Blob (cada put() es un Advanced Request): si la
        // fila ya tiene imagen se reutiliza sin subir nada. El guard original
        // reutilizaba CUALQUIER imagen previa, lo que cortocircuitaba el fix
        // de indiceCartel en cada re-scrape: una fila con la portada antigua
        // guardada nunca volvía a entrar en la rama del cartel y el
        // "auto-corrige en el siguiente run" era falso — la rama solo corría
        // con imagen_url a NULL. Ahora, si esta extracción señala un cartel
        // pero la imagen guardada es la PORTADA (blob sin sufijo -c<i>), se
        // corrige con una única subida; una imagen que ya es un cartel
        // concreto (cualquier -c<i>) se conserva tal cual, porque el índice
        // que devuelve el modelo varía entre runs y exigir coincidencia
        // exacta haría flapear la foto (y un put) en cada re-scrape. Sin
        // cartel se reutiliza lo que haya, como siempre.
        const imagenExistente = imagenPorOrigenId.get(origenId)
        const imagenCoherente = !cartel || /-c\d+\.\w+$/.test(String(imagenExistente || ''))
        let imagenUrl
        if (imagenExistente && imagenCoherente) {
          imagenUrl = imagenExistente
          resumen.imagenesReutilizadas++
        } else {
          imagenUrl = await subirImagen(
            'instagram',
            ev.shortCode,
            cartel ? cartel.imagen : ev.imagenOrigen,
            sufijo
          )
          if (imagenUrl) resumen.imagenesSubidas++
        }

        // xmax = 0 distingue INSERT de UPDATE. En el UPDATE no se tocan ni
        // estado ni notificado_en (ver cabecera del fichero), y la imagen
        // previa se conserva si esta vez no se pudo subir.
        const filas = await sql`
          INSERT INTO eventos_usuario
            (organizacion_id, titulo, descripcion, categoria, subcategoria,
             fecha_inicio, hora, lugar, url, imagen_url, estado, origen_externo_id)
          VALUES
            (${organizacionId}, ${ev.titulo}, ${ev.descripcion}, ${ev.categoria},
             ${ev.subcategoria}, ${ev.fecha}, ${ev.hora}, ${ev.lugar}, ${ev.url},
             ${imagenUrl}, ${ev.estado}, ${origenId})
          ON CONFLICT (origen_externo_id) WHERE origen_externo_id IS NOT NULL
          DO UPDATE SET
            organizacion_id = EXCLUDED.organizacion_id,
            titulo = EXCLUDED.titulo,
            descripcion = EXCLUDED.descripcion,
            categoria = EXCLUDED.categoria,
            subcategoria = EXCLUDED.subcategoria,
            fecha_inicio = EXCLUDED.fecha_inicio,
            hora = EXCLUDED.hora,
            lugar = EXCLUDED.lugar,
            url = EXCLUDED.url,
            imagen_url = COALESCE(EXCLUDED.imagen_url, eventos_usuario.imagen_url),
            actualizado_en = now()
          RETURNING (xmax = 0) AS insertado
        `
        if (filas[0]?.insertado) {
          resumen.creados++
          if (ev.estado === 'borrador') {
            resumen.creadosEnBorrador++
            pendientesEventos.push({ titulo: ev.titulo, fecha: ev.fecha })
          }
        } else {
          resumen.actualizados++
        }
        // Visible para el dedup del resto del run: dos posts del mismo lote
        // que anuncian el mismo acto tampoco deben crear dos filas.
        if (!yaPropio) {
          existentes.push({ origen_externo_id: origenId, titulo: ev.titulo, fecha: ev.fecha })
        }
      } catch (err) {
        resumen.errores.push(`Evento ${ev.shortCode}: ${err.message}`)
      }
    }

    // Aviso por email al superadmin si el run dejó borradores por validar
    // (hijas de un carrusel multi-evento). Fail-soft: un fallo del email no
    // rompe la sincronización.
    if (pendientesEventos.length) {
      try {
        await enviarEmailPendientes({
          eventos: pendientesEventos,
          origen:
            'La sincronización de eventos de Instagram ha dejado en borrador los eventos de un carrusel multi-evento:',
        })
      } catch (err) {
        resumen.errores.push(`Email de pendientes: ${err.message}`)
      }
    }

    console.log(JSON.stringify(resumen))
  } catch (err) {
    console.error('Error en sync-instagram (fondo):', err)
    resumen.errores.push(err.message)
    console.log(JSON.stringify(resumen))
  }

  // Log de la ejecución (tabla ingesta_log, solo observabilidad — nunca
  // lanza). candidatos son POSTS y nuevos/emparejados son FILAS de
  // eventos_usuario (creados/actualizados): no tienen por qué cuadrar entre sí.
  await registrarIngesta({
    fuente: 'sync-instagram',
    candidatos: resumen.recibidos,
    emparejados: resumen.actualizados,
    nuevos: resumen.creados,
    motivos: {
      'post no normalizable': noNormalizables,
      'antigüedad (>30 días) o tope de posts': resumen.descartadosPorAntiguedad,
      // Los posts de un lote que falló NO los rechazó el triaje: el modelo ni
      // los llegó a ver. Se restan aquí y se cuentan en su propio motivo.
      'no es evento (rechazo del triaje del modelo)': Math.max(
        0,
        resumen.analizados - resumen.postsNoEvaluados - extraidosTotal
      ),
      ...motivosLote,
      'validación de la extracción': resumen.descartadosPorValidacion,
      'duplicado de evento existente': resumen.duplicadosOmitidos,
      ...motivosVisión,
    },
  })
}
