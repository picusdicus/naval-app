// Optimización de imágenes en el navegador antes de enviar al servidor.
// Usa Canvas API para redimensionar y convertir a WebP.

/**
 * Optimiza una imagen: redimensiona y convierte a WebP.
 * @param {File} file — imagen original
 * @param {number} maxWidth — ancho máximo (height se escala proporcionalmente)
 * @param {string} mimeType — tipo MIME destino (ej. 'image/webp')
 * @returns {Promise<{datos: string, tipo: string}>} base64 de la imagen optimizada
 */
export async function optimizarImagen(file, maxWidth, mimeType = 'image/webp') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        try {
          // Calcular nuevas dimensiones
          let width = img.width
          let height = img.height

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }

          // Canvas y dibujo
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('No se pudo obtener contexto de canvas')

          ctx.drawImage(img, 0, 0, width, height)

          // Convertir a base64 con formato WebP
          canvas.toBlob(
            (blob) => {
              if (!blob) throw new Error('Canvas.toBlob() retornó null')

              const reader2 = new FileReader()
              reader2.onload = () => {
                const base64 = reader2.result.split(',')[1]
                resolve({
                  datos: base64,
                  tipo: mimeType,
                })
              }
              reader2.onerror = () => reject(new Error('Error al leer blob optimizado'))
              reader2.readAsDataURL(blob)
            },
            mimeType,
            0.85
          )
        } catch (err) {
          reject(err)
        }
      }

      img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
      img.src = e.target.result
    }

    reader.onerror = () => reject(new Error('Error al leer archivo'))
    reader.readAsDataURL(file)
  })
}

/**
 * Valida el tipo de archivo y tamaño.
 * @returns {string} error si no es válido, vacío si ok
 */
export function validarImagen(file, maxMB = 3) {
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp']
  if (!tiposPermitidos.includes(file.type)) {
    return 'Formato no permitido. Usa JPG, PNG o WebP.'
  }

  const maxBytes = maxMB * 1024 * 1024
  if (file.size > maxBytes) {
    return `La imagen no puede superar ${maxMB} MB.`
  }

  return ''
}
