// Hook React para resolver la imagen de un evento.
// Lee las imágenes genéricas del Context (ya cacheadas en App.jsx).

import { useContext, useMemo } from 'react'
import { imagenEvento } from './imagenesEvento.js'
import { GenericasEventoContext } from './GenericasEventoContext.jsx'
import { disciplinaDeEvento } from './eventos.js'

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

    // Filtrar genéricas por categoría y disciplina del evento.
    // Cuando disciplina es null (evento no reconocido), solo recibe genéricas
    // sin disciplina específica (generales de categoría). Cuando sí se reconoce,
    // compara por igualdad exacta.
    const disciplina = disciplinaDeEvento(evento)
    const genericasFiltradas = genericas.filter((img) => {
      if (img.categoria !== evento.categoria) return false
      return disciplina === null ? img.disciplina === null : img.disciplina === disciplina
    })

    return imagenEvento(evento, { ...options, genericas: genericasFiltradas })
  }, [evento, genericas, options, options?.paraHeroe])
}
