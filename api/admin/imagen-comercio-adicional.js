import { put } from '@vercel/blob'
import { requerirSesion } from '../_auth.js'
import { obtenerSql } from '../_db.js'
import { organizacionDeSesion } from '../_organizacion.js'
import { csrfInvalido } from '../_http.js'

export const config = { runtime: 'nodejs' }

const MAX_SIZE = 3 * 1024 * 1024

const hayCredencialesBlob = () =>
  Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  )

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

  if (!hayCredencialesBlob()) {
    return res.status(503).json({
      error: 'La subida de imágenes no está configurada (faltan las credenciales de Vercel Blob).',
    })
  }

  const { imagenes } = req.body || {}

  if (!Array.isArray(imagenes) || imagenes.length === 0) {
    return res.status(400).json({ error: 'No hay imágenes para subir.' })
  }

  if (imagenes.length > 5) {
    return res.status(400).json({ error: 'Máximo 5 imágenes.' })
  }

  try {
    const sql = obtenerSql()
    const org = await organizacionDeSesion(sql, sesion.organizacionSlug)

    if (!org.comercio_id) {
      return res.status(404).json({ error: 'Org sin comercio vinculado.' })
    }

    const urlsSubidas = []

    for (let i = 0; i < imagenes.length; i++) {
      try {
        const dataUrl = imagenes[i]

        // Validar formato data URL
        if (!dataUrl || !dataUrl.startsWith('data:image/')) {
          return res.status(400).json({
            error: `Imagen ${i + 1}: formato no válido.`,
          })
        }

        // Extraer datos base64
        const [header, base64Data] = dataUrl.split(';base64,')
        if (!header || !base64Data) {
          return res.status(400).json({
            error: `Imagen ${i + 1}: formato de data URL no válido.`,
          })
        }

        // Extraer tipo MIME
        const mimeType = header.replace('data:', '')
        const buffer = Buffer.from(base64Data, 'base64')

        if (buffer.length === 0) {
          return res.status(400).json({
            error: `Imagen ${i + 1}: la imagen no se pudo leer.`,
          })
        }

        if (buffer.length > MAX_SIZE) {
          return res.status(413).json({
            error: `Imagen ${i + 1}: supera los 3 MB.`,
          })
        }

        const blob = await put(
          `comercios/${org.comercio_id}/fotos/${i + 1}.webp`,
          buffer,
          {
            access: 'public',
            contentType: 'image/webp',
            addRandomSuffix: false,
            allowOverwrite: true,
            ...(process.env.BLOB_READ_WRITE_TOKEN
              ? { token: process.env.BLOB_READ_WRITE_TOKEN }
              : {}),
          }
        )

        urlsSubidas.push(blob.url)
      } catch (err) {
        console.error(`Error subiendo imagen ${i + 1}:`, err)
        return res.status(500).json({
          error: `Error subiendo imagen ${i + 1}: ${err instanceof Error ? err.message : 'desconocido'}`,
        })
      }
    }

    return res.status(200).json({ ok: true, urls: urlsSubidas })
  } catch (error) {
    console.error('Error en imagen-comercio-adicional:', error)
    return res.status(500).json({
      error: `Error: ${error instanceof Error ? error.message : 'desconocido'}`,
    })
  }
}
