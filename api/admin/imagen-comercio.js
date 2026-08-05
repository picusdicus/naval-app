// POST /api/admin/imagen-comercio — sube foto principal o galería de un comercio a Vercel Blob.
// La imagen llega en base64 dentro del JSON, no como multipart.
// Node (no Edge): reutiliza lógica de imagen.js con @vercel/blob.
import { put } from '@vercel/blob'
import { requerirSesion } from '../_auth.js'
import { organizacionDeSesion } from '../_organizacion.js'
import { obtenerSql } from '../_db.js'
import { csrfInvalido } from '../_http.js'

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

function nombreSeguro(nombre, extension) {
  const base = String(nombre || 'foto')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'foto'}.${extension}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }
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

  // Solo orgs con comercio vinculado pueden subir fotos
  const sql = require('./_db.js').obtenerSql()
  const org = await require('./_organizacion.js').organizacionDeSesion(sql, sesion.organizacionSlug)

  if (!org.comercio_id) {
    return res.status(403).json({ error: 'Org sin comercio vinculado.' })
  }

  const { tipo, numero, datos, mimeType } = req.body || {}

  if (!['principal', 'galeria'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo debe ser "principal" o "galeria".' })
  }

  if (tipo === 'galeria' && (numero < 1 || numero > 5)) {
    return res.status(400).json({ error: 'Número de foto debe estar entre 1 y 5.' })
  }

  const extension = TIPOS_PERMITIDOS[mimeType]
  if (!extension) {
    return res.status(400).json({ error: 'Formato no admitido. Usa JPG, PNG o WebP.' })
  }

  if (!datos) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen.' })
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
      error: 'La subida de imágenes no está configurada (faltan credenciales de Vercel Blob).',
    })
  }

  try {
    const ruta =
      tipo === 'principal'
        ? `comercios/${org.comercio_id}/principal.webp`
        : `comercios/${org.comercio_id}/fotos/${numero}.webp`

    const { url } = await put(ruta, contenido, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
      allowOverwrite: true,
      ...(process.env.BLOB_READ_WRITE_TOKEN
        ? { token: process.env.BLOB_READ_WRITE_TOKEN }
        : {}),
    })

    return res.status(200).json({ url })
  } catch (error) {
    console.error('Fallo al subir imagen a Blob:', error)
    return res.status(502).json({ error: 'No se pudo subir la imagen. Inténtalo de nuevo.' })
  }
}
