// Hook React para resolver la imagen de un evento.
// Lee las imágenes genéricas del Context (ya cacheadas en App.jsx).

import { useContext, useMemo } from 'react'
import { imagenEvento } from './imagenesEvento.js'
import { GenericasEventoContext } from './GenericasEventoContext.jsx'

const MOSTRAR_IMAGENES_GENERICAS = false

/**
 * Hook que resuelve la imagen de un evento.
 * @param {object} evento — evento del que obtener imagen
 * @param {object} options — {paraHeroe: boolean}
 * @returns {object|null} {src, pos?, credito, real}
 *
 * Lee las genéricas del Context (una sola petición compartida en App).
 */
export function useImagenEvento(evento, options = {}) {
  const genericas = useContext(GenericasEventoContext)

  return useMemo(() => {
    if (!evento) return null

    if (!MOSTRAR_IMAGENES_GENERICAS) {
      return imagenEvento(evento, options)
    }

    // Filtrar genéricas por categoría y disciplina del evento
    const genericasFiltradas = genericas.filter(
      (img) =>
        img.categoria === evento.categoria &&
        (!evento.disciplina || img.disciplina === evento.disciplina)
    )

    return imagenEvento(evento, { ...options, genericas: genericasFiltradas })
  }, [evento, genericas, options, options?.paraHeroe])
}
