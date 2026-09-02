// POST /api/admin/imagen-evento-generica — sube y registra una imagen genérica de evento.
// Calcado de api/admin/imagen.js, pero guarda metadata en Neon además de Blob.
// PATCH /api/admin/imagen-evento-generica?id=<uuid> — cambia el campo activo.
// DELETE /api/admin/imagen-evento-generica?id=<uuid> — borra la fila (blob queda huérfano).

import { put, del } from '@vercel/blob'
import { requerirSesion } from '../_auth.js'
import { csrfInvalido } from '../_http.js'
import { obtenerSql } from '../_db.js'

// Serverless (Node) a propósito: @vercel/blob no funciona en Edge (ver imagen.js).
export const config = { runtime: 'nodejs' }

const TIPOS_PERMITIDOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const MAX_BYTES = 3 * 1024 * 1024

const hayCredencialesBlob = () =>
  Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  )

function nombreSeguro(categoria, disciplina) {
  const base = disciplina ? `${categoria}-${disciplina}` : categoria
  return `${base}-${Date.now()}`
}

export default async function handler(req, res) {
  if (csrfInvalido(req)) {
    return res.status(403).json({ error: 'Origen no permitido.' })
  }

  let sesion
  try {
    sesion = await requerirSesion(req, res)
  } catch (error) {
    console.error('Sesión mal configurada:', error.message)
    return res.status(401).json({ error: 'No autenticado' })
  }
  if (!sesion) return
  if (sesion.rol !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo superadmin.' })
  }

  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  if (req.method === 'PATCH') return handlePatch(req, res)
  if (req.method === 'DELETE') return handleDelete(req, res)

  return res.status(405).json({ error: 'Método no permitido' })
}

// Todas las filas, activas o no, con la columna `activo`: el GET público solo
// devuelve las activas y sin ese campo, y el panel necesita poder reactivarlas.
async function handleGet(req, res) {
  try {
    const sql = obtenerSql()
    const imagenes = await sql`
      SELECT id, categoria, disciplina, url, autor, fuente, licencia, descripcion, activo
      FROM imagenes_evento_genericas
      ORDER BY categoria, disciplina, creado_en
    `
    return res.status(200).json({ imagenes })
  } catch (error) {
    console.error('Fallo al listar imágenes genéricas:', error)
    return res.status(502).json({ error: 'No se pudo cargar la lista.' })
  }
}

async function handlePost(req, res) {
  const { nombre, tipo, datos, categoria, disciplina, autor, fuente, licencia, descripcion } =
    req.body || {}

  // Validar entrada
  const extension = TIPOS_PERMITIDOS[tipo]
  if (!extension) {
    return res.status(400).json({ error: 'Formato no admitido. Usa JPG, PNG o WebP.' })
  }
  if (!datos) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen.' })
  }
  if (!categoria) {
    return res.status(400).json({ error: 'Falta la categoría.' })
  }

  const contenido = Buffer.from(String(datos), 'base64')
  if (contenido.length === 0) {
    return res.status(400).json({ error: 'La imagen no se pudo leer.' })
  }
  if (contenido.length > MAX_BYTES) {
    return res.status(413).json({ error: 'La imagen supera los 3 MB.' })
  }

  if (!hayCredencialesBlob()) {
    return res.status(503).json({
      error: 'La subida de imágenes no está configurada (faltan las credenciales de Vercel Blob).',
    })
  }

  try {
    const carpeta = disciplina
      ? `eventos-genericas/${categoria}/${disciplina}`
      : `eventos-genericas/${categoria}`

    const { url } = await put(`${carpeta}/${nombreSeguro(categoria, disciplina)}.${extension}`, contenido, {
      access: 'public',
      contentType: tipo,
      addRandomSuffix: false,
      ...(process.env.BLOB_READ_WRITE_TOKEN
        ? { token: process.env.BLOB_READ_WRITE_TOKEN }
        : {}),
    })

    // Guardar en Neon
    const sql = obtenerSql()
    const resultado = await sql`
      INSERT INTO imagenes_evento_genericas
        (categoria, disciplina, url, autor, fuente, licencia, descripcion, activo)
      VALUES
        (${categoria}, ${disciplina || null}, ${url}, ${autor || null}, ${fuente || null}, ${licencia || null}, ${descripcion || null}, true)
      RETURNING id, categoria, disciplina, url, autor, fuente, licencia, descripcion, activo
    `

    const fila = resultado[0]
    return res.status(201).json(fila)
  } catch (error) {
    console.error('Fallo al subir la imagen:', error)
    return res.status(502).json({ error: 'No se pudo subir la imagen. Inténtalo de nuevo.' })
  }
}

async function handlePatch(req, res) {
  const { id } = req.query || {}
  if (!id) {
    return res.status(400).json({ error: 'Falta el id.' })
  }

  const { activo } = req.body || {}
  if (activo === undefined) {
    return res.status(400).json({ error: 'Falta el campo activo.' })
  }

  try {
    const sql = obtenerSql()
    const resultado = await sql`
      UPDATE imagenes_evento_genericas
      SET activo = ${Boolean(activo)}
      WHERE id = ${id}
      RETURNING id, categoria, disciplina, url, autor, fuente, licencia, descripcion, activo
    `

    if (resultado.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada.' })
    }

    return res.status(200).json(resultado[0])
  } catch (error) {
    console.error('Fallo al actualizar:', error)
    return res.status(502).json({ error: 'No se pudo actualizar. Inténtalo de nuevo.' })
  }
}

async function handleDelete(req, res) {
  const { id } = req.query || {}
  if (!id) {
    return res.status(400).json({ error: 'Falta el id.' })
  }

  try {
    const sql = obtenerSql()
    const resultado = await sql`
      SELECT url FROM imagenes_evento_genericas
      WHERE id = ${id}
    `

    if (resultado.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada.' })
    }

    const { url } = resultado[0]

    // Borrar de Blob si es posible (fail-soft si falla)
    if (url && hayCredencialesBlob()) {
      try {
        await del(url, {
          ...(process.env.BLOB_READ_WRITE_TOKEN
            ? { token: process.env.BLOB_READ_WRITE_TOKEN }
            : {}),
        })
      } catch (blobError) {
        console.warn('No se pudo borrar blob:', blobError)
      }
    }

    // Borrar de Neon
    await sql`DELETE FROM imagenes_evento_genericas WHERE id = ${id}`

    return res.status(204).end()
  } catch (error) {
    console.error('Fallo al borrar:', error)
    return res.status(502).json({ error: 'No se pudo borrar. Inténtalo de nuevo.' })
  }
}
