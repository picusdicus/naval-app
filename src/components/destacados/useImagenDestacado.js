import { useCallback, useEffect, useState } from 'react'

/**
 * Imagen de una tarjeta de destacado tolerando que la URL falle al cargar.
 *
 * `destacado` es la forma `tarjeta` de src/lib/destacados.js: `imagen` es la
 * principal (contratada, cartel propio o ilustrativa) e `imagenReserva` la
 * ilustrativa que le tocaría sin foto propia (solo cuando la principal es un
 * cartel real). Un cartel externo que ya no existe (404 de navalcarnero.es)
 * pasa a la reserva; si también falla o no hay, `imagen` queda vacía y el
 * componente pinta su bloque de color de categoría.
 *
 * Devuelve {imagen, imagenPos, onError}; enchufar `onError` a cada <img>.
 */
export function useImagenDestacado(destacado) {
  const [fallos, setFallos] = useState(0)

  // Reset al cambiar de item: las tarjetas se reutilizan entre elementos de un
  // carrusel y un fallo heredado escondería una foto que sí carga.
  useEffect(() => {
    setFallos(0)
  }, [destacado.imagen])

  const onError = useCallback(() => setFallos((n) => n + 1), [])

  const imagen =
    fallos === 0 ? destacado.imagen || '' : fallos === 1 ? destacado.imagenReserva || '' : ''
  const imagenPos = fallos === 0 ? destacado.imagenPos : undefined

  return { imagen, imagenPos, onError }
}
