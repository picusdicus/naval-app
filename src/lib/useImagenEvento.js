// Hook React para resolver la imagen de un evento de forma asíncrona.
// Fusiona el pool hardcodeado con las genericas de Neon (si MOSTRAR_IMAGENES_GENERICAS=true).

import { useState, useEffect } from 'react'
import { imagenEvento } from './imagenesEvento.js'

const MOSTRAR_IMAGENES_GENERICAS = false

/**
 * Hook que resuelve la imagen de un evento.
 * @param {object} evento — evento del que obtener imagen
 * @param {object} options — {paraHeroe: boolean}
 * @returns {object|null} {src, pos?, credito, real, cargando?}
 *
 * Mientras carga, devuelve null (el componente cae al degradado). Al resolver,
 * devuelve la imagen. Si MOSTRAR_IMAGENES_GENERICAS=false, devuelve directamente
 * sin esperar (compatibilidad backward).
 */
export function useImagenEvento(evento, options = {}) {
  const [imagen, setImagen] = useState(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!evento) {
      setImagen(null)
      return
    }

    if (!MOSTRAR_IMAGENES_GENERICAS) {
      // Sin genericas activas, solo el pool hardcodeado (síncrono)
      setImagen(imagenEvento(evento, options))
      return
    }

    setCargando(true)
    ;(async () => {
      try {
        const res = await fetch('/api/imagenes-evento-genericas')
        if (!res.ok) throw new Error('No se pudieron cargar imágenes genéricas')

        const { imagenes } = await res.json()
        // Filtrar por categoría (y disciplina si aplica)
        const genericas = imagenes.filter(
          (img) =>
            img.categoria === evento.categoria &&
            (!evento.disciplina || img.disciplina === evento.disciplina)
        )

        const resultado = imagenEvento(evento, { ...options, genericas })
        setImagen(resultado)
      } catch (error) {
        console.warn('Error cargando imágenes genéricas:', error)
        // Fallback al pool hardcodeado nada más
        setImagen(imagenEvento(evento, options))
      } finally {
        setCargando(false)
      }
    })()
  }, [evento, evento?.id, evento?.categoria, evento?.disciplina, options, options?.paraHeroe])

  return imagen
}
