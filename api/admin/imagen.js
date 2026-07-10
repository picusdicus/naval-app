// POST /api/admin/imagen — sube el cartel de un evento a Vercel Blob.
//
// La imagen llega en base64 dentro del JSON, no como multipart: así reutiliza
// el mismo parseo de cuerpo que el resto de endpoints (y el middleware de
// desarrollo de vite.config.js). Vercel limita el cuerpo de una función a
// 4,5 MB y base64 infla un 33 %, de ahí el tope de 3 MB.
import { put } from '@vercel/blob'
import { requerirSesion } from '../_auth.js'

const TIPOS_PERMITIDOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const MAX_BYTES = 3 * 1024 * 1024

/** Nombre de fichero seguro: sin rutas, sin acentos, sin espacios. */
function nombreSeguro(nombre, extension) {
  const base = String(nombre || 'cartel')
    .replace(/\.[^.]+$/, '')
    // Todo lo que no sea alfanumérico (acentos y separadores de ruta incluidos)
    // se colapsa en guiones.
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'cartel'}.${extension}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  let sesion
  try {
    sesion = requerirSesion(req, res)
  } catch (error) {
    console.error('Sesión mal configurada:', error.message)
    return res.status(401).json({ error: 'No autenticado' })
  }
  if (!sesion) return

  // Primero lo que ha enviado el usuario, y solo después la infraestructura:
  // un formato no admitido debe decir "usa JPG" aunque falte el token.
  const { nombre, tipo, datos } = req.body || {}

  const extension = TIPOS_PERMITIDOS[tipo]
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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: 'La subida de imágenes no está configurada (falta BLOB_READ_WRITE_TOKEN).',
    })
  }

  try {
    const { url } = await put(
      `eventos/${sesion.organizacionSlug}/${nombreSeguro(nombre, extension)}`,
      contenido,
      { access: 'public', contentType: tipo, addRandomSuffix: true }
    )
    return res.status(200).json({ url })
  } catch (error) {
    console.error('Fallo al subir la imagen a Blob:', error)
    return res.status(502).json({ error: 'No se pudo subir la imagen. Inténtalo de nuevo.' })
  }
}
