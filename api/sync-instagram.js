// POST /api/sync-instagram — webhook de Apify: convierte posts de Instagram de
// cultura_navalcarnero (y de ayuntamientonavalcarnero, cuya task de noticias
// también apunta aquí con un segundo webhook) en eventos de la agenda.
//
// Flujo: Apify termina su ejecución semanal → llama aquí → se identifican con
// Claude los posts que anuncian un evento real (fecha + hora + lugar en el
// caption) → la imagen del post se sube a Vercel Blob (las URLs del CDN de
// Instagram caducan) → upsert en eventos_usuario bajo la organización que
// corresponde al autor del post (ORG_POR_USUARIO), en estado 'publicado'.
//
// Integración con el resto del sistema, sin tocar el cron diario:
// - GET /api/eventos ya emite estos eventos con origen 'cultural' y la
//   organización como fuente/"Organiza" (p. ej. 'Cultura Navalcarnero' para
//   los posts de cultura_navalcarnero — la fuente es el nombre del JOIN).
// - El digest push diario (api/sync-events.js) los anuncia solo: entran como
//   filas publicadas futuras con notificado_en NULL.
// - El upsert usa eventos_usuario.origen_externo_id ('ig-<shortCode>', índice
//   único parcial): re-ejecutar el webhook actualiza en vez de duplicar, y una
//   edición no re-notifica (notificado_en no se toca en el UPDATE). El estado
//   tampoco: un evento archivado a mano por el superadmin no resucita.
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
import { SUBCATEGORIAS_CULTURA } from '../src/lib/eventos.js'
import { claveTitulo, titulosEquivalentes } from '../src/lib/dedupEventos.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

// Misma taxonomía que eventos.json / la UI de la agenda.
const CATEGORIAS = ['cultura', 'deporte', 'fiestas', 'gastronomia', 'infantil', 'mercado']

// Subcategorías DENTRO de cultura (teatro, cine, …): afinan los filtros de la
// agenda sin trocear la categoría paraguas (los temas de push 'cat:cultura' y
// el perfil de las orgs no se tocan). Whitelist compartida con la UI.
const SUBCATEGORIAS = Object.keys(SUBCATEGORIAS_CULTURA)

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
        required: ['shortCode', 'titulo', 'fecha', 'hora', 'lugar', 'categoria', 'subcategoria', 'descripcion'],
        properties: {
          shortCode: { type: 'string' },
          titulo: { type: 'string' },
          fecha: { type: 'string' },
          hora: { type: 'string' },
          lugar: { type: 'string' },
          categoria: { enum: CATEGORIAS },
          // '' = sin subcategoría (no es cultura, o no está clara).
          subcategoria: { enum: [...SUBCATEGORIAS, ''] },
          descripcion: { type: 'string' },
        },
      },
    },
  },
}

const INSTRUCCIONES = `Analiza posts de Instagram de cuentas municipales de Navalcarnero (Madrid) — la concejalía de cultura y el Ayuntamiento — e identifica cuáles anuncian un EVENTO REAL al que un vecino puede asistir.

Un post es un evento SOLO si menciona explícitamente las tres cosas: una fecha concreta, una hora y un lugar. Pueden aparecer en el caption o en el texto del cartel (campo "alt", la descripción automática de la imagen) — es habitual que el caption sea solo la sinopsis y los datos prácticos estén en el cartel.

Además, un evento de agenda es un ACTO al que el vecino asiste en un momento concreto como público o participante: una función, un concierto, una proyección, una fiesta, un mercado, una carrera popular, un encierro. Tener fecha, hora y lugar NO basta. Descarta aunque los tengan:
- Aperturas de plazos de inscripción y bases de concursos (cursos de natación, talleres, campamentos).
- Campañas y servicios: donaciones de sangre, sorteos comerciales, custodia de llaves, objetos perdidos.
- Horarios de temporada o de instalaciones (piscina municipal, biblioteca, polideportivo).
- Noticias, agradecimientos, balances y comunicados.
- Actos fuera de Navalcarnero.

Para cada evento devuelve:
- shortCode: el del post, copiado tal cual.
- titulo: corto y legible en español (sin mayúsculas gritadas).
- fecha: YYYY-MM-DD. Resuelve fechas relativas ("este sábado 18") con el campo "publicado" del post. Si el evento dura varios días, usa el día de inicio.
- hora: HH:MM en formato 24 h.
- lugar: el nombre del sitio tal como aparece (sin ", Navalcarnero").
- categoria: la más apropiada de la lista permitida.
- subcategoria: SOLO si categoria es "cultura", el tipo concreto de acto: "teatro", "cine", "musica" (conciertos, recitales), "danza", "exposicion", u "otros" si es cultural pero no encaja en ninguno. Para cualquier otra categoria, "".
- descripcion: el caption limpio de hashtags y menciones, máximo 400 caracteres.

Devuelve solo los posts que son eventos; si ninguno lo es, devuelve la lista vacía.`

// En lotes por el mismo motivo que el triaje de noticias: la respuesta de un
// run entero (50 posts) puede superar max_tokens y llegar truncada — el
// JSON.parse del texto cortado tumbaba el run completo.
const LOTE_TRIAJE = 10

async function extraerEventos(posts) {
  const client = new Anthropic()
  const lotes = []
  for (let i = 0; i < posts.length; i += LOTE_TRIAJE) {
    lotes.push(posts.slice(i, i + LOTE_TRIAJE))
  }
  // Lotes en paralelo: el tiempo total pasa a ser ~el de un lote.
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
        const texto = respuesta.content.find((b) => b.type === 'text')?.text || '{"eventos":[]}'
        return { items: JSON.parse(texto).eventos || [] }
      } catch (err) {
        return { error: `Extracción lote ${idx + 1}: ${err.message}` }
      }
    })
  )
  const eventos = []
  const errores = []
  for (const r of resultados) {
    if (r.error) errores.push(r.error)
    else eventos.push(...r.items)
  }
  return { eventos, errores }
}

/** Valida los valores extraídos contra los posts realmente enviados. */
function validarExtraccion(eventos, postsPorShortCode) {
  const validos = []
  const descartados = []
  const vistos = new Set()
  for (const ev of Array.isArray(eventos) ? eventos : []) {
    const post = postsPorShortCode.get(ev.shortCode)
    const valido =
      post &&
      !vistos.has(ev.shortCode) &&
      typeof ev.titulo === 'string' &&
      ev.titulo.trim() &&
      /^\d{4}-\d{2}-\d{2}$/.test(ev.fecha) &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(ev.hora) &&
      typeof ev.lugar === 'string' &&
      ev.lugar.trim() &&
      CATEGORIAS.includes(ev.categoria)
    if (!valido) {
      descartados.push(ev.shortCode || '(sin shortCode)')
      continue
    }
    vistos.add(ev.shortCode)
    validos.push({
      shortCode: ev.shortCode,
      titulo: ev.titulo.trim().slice(0, 200),
      fecha: ev.fecha,
      hora: ev.hora,
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
    })
  }
  return { validos, descartados }
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
    actualizados: 0,
    duplicadosOmitidos: 0,
    descartadosPorValidacion: 0,
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
    if (posts.length === 0) {
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
    const tarea = procesar(posts, resumen)
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
async function procesar(posts, resumen) {
  try {
    const postsPorShortCode = new Map(posts.map((p) => [p.shortCode, p]))
    const { eventos: extraidos, errores: erroresTriaje } = await extraerEventos(
      posts.map(({ shortCode, caption, alt, publicado }) => ({ shortCode, caption, alt, publicado }))
    )
    resumen.errores.push(...erroresTriaje)
    const { validos, descartados } = validarExtraccion(extraidos, postsPorShortCode)
    resumen.eventos = validos.length
    resumen.descartadosPorValidacion = descartados.length
    if (descartados.length) {
      resumen.errores.push(`Extracciones descartadas por validación: ${descartados.join(', ')}`)
    }

    const sql = obtenerSql()
    await asegurarColumnaOrigen(sql)

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
    const idsEventos = validos.map((v) => `ig-${v.shortCode}`)
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
        const origenId = `ig-${ev.shortCode}`
        const yaPropio = existentes.some((e) => e.origen_externo_id === origenId)
        if (!yaPropio) {
          const clave = claveTitulo(ev.titulo)
          const gemelo = existentes.find(
            (e) =>
              e.fecha === ev.fecha &&
              e.origen_externo_id !== origenId &&
              titulosEquivalentes(claveTitulo(e.titulo), clave)
          )
          if (gemelo) {
            resumen.duplicadosOmitidos++
            continue
          }
        }

        const organizacionId = await organizacionDe(ev.usuario)
        const imagenExistente = imagenPorOrigenId.get(origenId)
        let imagenUrl
        if (imagenExistente) {
          imagenUrl = imagenExistente
          resumen.imagenesReutilizadas++
        } else {
          imagenUrl = await subirImagen('instagram', ev.shortCode, ev.imagenOrigen)
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
             ${imagenUrl}, 'publicado', ${`ig-${ev.shortCode}`})
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
        if (filas[0]?.insertado) resumen.creados++
        else resumen.actualizados++
        // Visible para el dedup del resto del run: dos posts del mismo lote
        // que anuncian el mismo acto tampoco deben crear dos filas.
        if (!yaPropio) {
          existentes.push({ origen_externo_id: origenId, titulo: ev.titulo, fecha: ev.fecha })
        }
      } catch (err) {
        resumen.errores.push(`Evento ${ev.shortCode}: ${err.message}`)
      }
    }

    console.log(JSON.stringify(resumen))
  } catch (err) {
    console.error('Error en sync-instagram (fondo):', err)
    resumen.errores.push(err.message)
    console.log(JSON.stringify(resumen))
  }
}
