// POST /api/sync-instagram — webhook de Apify: convierte posts de Instagram de
// cultura_navalcarnero en eventos de la agenda.
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
import { igualSeguro } from './_auth.js'
import { obtenerSql } from './_db.js'
import { MAX_POSTS, normalizarPost, obtenerPosts, subirImagen } from './_instagram.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

// Misma taxonomía que eventos.json / la UI de la agenda.
const CATEGORIAS = ['cultura', 'deporte', 'fiestas', 'gastronomia', 'infantil', 'mercado']

// Atribución por autor: ownerUsername del post → organización de la agenda
// (el "Organiza" de la ficha y la `fuente` del GET público salen del nombre de
// la organización). Los posts en colaboración con otras cuentas aparecen en el
// perfil de cultura_navalcarnero con el ownerUsername del coautor: mientras no
// tengan entrada propia aquí, se atribuyen también a la concejalía.
const ORG_CULTURA = {
  nombre: 'Cultura Navalcarnero',
  slug: 'cultura-navalcarnero',
  descripcion:
    'Eventos publicados en Instagram por cultura_navalcarnero y sincronizados automáticamente.',
  categoriaDefecto: 'cultura',
  lugarDefecto: 'Navalcarnero',
}

const ORG_POR_USUARIO = {
  cultura_navalcarnero: ORG_CULTURA,
}

function orgDeUsuario(usuario) {
  return ORG_POR_USUARIO[String(usuario || '').toLowerCase()] || ORG_CULTURA
}

// Constantes de posts e imágenes y helpers de Apify/Blob compartidos con el
// webhook de noticias: en api/_instagram.js.

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
        required: ['shortCode', 'titulo', 'fecha', 'hora', 'lugar', 'categoria', 'descripcion'],
        properties: {
          shortCode: { type: 'string' },
          titulo: { type: 'string' },
          fecha: { type: 'string' },
          hora: { type: 'string' },
          lugar: { type: 'string' },
          categoria: { enum: CATEGORIAS },
          descripcion: { type: 'string' },
        },
      },
    },
  },
}

const INSTRUCCIONES = `Analiza posts de Instagram de la concejalía de cultura de Navalcarnero (Madrid) e identifica cuáles anuncian un EVENTO REAL al que un vecino puede asistir.

Un post es un evento SOLO si su caption menciona explícitamente las tres cosas: una fecha concreta, una hora y un lugar. Descarta aperturas de plazos de inscripción, bases de concursos, noticias, agradecimientos, y actos fuera de Navalcarnero.

Para cada evento devuelve:
- shortCode: el del post, copiado tal cual.
- titulo: corto y legible en español (sin mayúsculas gritadas).
- fecha: YYYY-MM-DD. Resuelve fechas relativas ("este sábado 18") con el campo "publicado" del post. Si el evento dura varios días, usa el día de inicio.
- hora: HH:MM en formato 24 h.
- lugar: el nombre del sitio tal como aparece (sin ", Navalcarnero").
- categoria: la más apropiada de la lista permitida.
- descripcion: el caption limpio de hashtags y menciones, máximo 400 caracteres.

Devuelve solo los posts que son eventos; si ninguno lo es, devuelve la lista vacía.`

async function extraerEventos(posts) {
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
  const texto = respuesta.content.find((b) => b.type === 'text')?.text || '{"eventos":[]}'
  return JSON.parse(texto).eventos || []
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
}

/** Auto-provisiona (idempotente) la organización de un autor; devuelve su id. */
async function asegurarOrganizacion(sql, org) {
  const filas = await sql`
    INSERT INTO organizaciones (nombre, slug, descripcion, categoria_defecto, lugar_defecto, activa)
    VALUES (${org.nombre}, ${org.slug}, ${org.descripcion},
            ${org.categoriaDefecto}, ${org.lugarDefecto}, true)
    ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre
    RETURNING id
  `
  return filas[0].id
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
    eventos: 0,
    creados: 0,
    actualizados: 0,
    descartadosPorValidacion: 0,
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
    const extraidos = await extraerEventos(
      posts.map(({ shortCode, caption, publicado }) => ({ shortCode, caption, publicado }))
    )
    const { validos, descartados } = validarExtraccion(extraidos, postsPorShortCode)
    resumen.eventos = validos.length
    resumen.descartadosPorValidacion = descartados.length
    if (descartados.length) {
      resumen.errores.push(`Extracciones descartadas por validación: ${descartados.join(', ')}`)
    }

    const sql = obtenerSql()
    await asegurarColumnaOrigen(sql)

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
        const organizacionId = await organizacionDe(ev.usuario)
        const imagenUrl = await subirImagen('instagram', ev.shortCode, ev.imagenOrigen)
        if (imagenUrl) resumen.imagenesSubidas++

        // xmax = 0 distingue INSERT de UPDATE. En el UPDATE no se tocan ni
        // estado ni notificado_en (ver cabecera del fichero), y la imagen
        // previa se conserva si esta vez no se pudo subir.
        const filas = await sql`
          INSERT INTO eventos_usuario
            (organizacion_id, titulo, descripcion, categoria, fecha_inicio, hora,
             lugar, url, imagen_url, estado, origen_externo_id)
          VALUES
            (${organizacionId}, ${ev.titulo}, ${ev.descripcion}, ${ev.categoria},
             ${ev.fecha}, ${ev.hora}, ${ev.lugar}, ${ev.url}, ${imagenUrl},
             'publicado', ${`ig-${ev.shortCode}`})
          ON CONFLICT (origen_externo_id) WHERE origen_externo_id IS NOT NULL
          DO UPDATE SET
            organizacion_id = EXCLUDED.organizacion_id,
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
        if (filas[0]?.insertado) resumen.creados++
        else resumen.actualizados++
      } catch (err) {
        resumen.errores.push(`Evento ${ev.shortCode}: ${err.message}`)
      }
    }

    console.log(JSON.stringify(resumen))
    res.status(200).json(resumen)
  } catch (err) {
    console.error('Error en sync-instagram:', err)
    resumen.errores.push(err.message)
    res.status(500).json(resumen)
  }
}
