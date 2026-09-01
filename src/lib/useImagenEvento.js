import { useCallback, useEffect, useState } from 'react'
import { imagenEvento } from './imagenesEvento.js'

/**
 * Resuelve la imagen de un evento tolerando que la URL esté rota.
 *
 * `imagenEvento()` es optimista por necesidad: decide mirando solo si el campo
 * `imagen` trae algo, y una URL que responde 404 es un string perfectamente
 * truthy. Con eso, la rama del <img> se tomaba igual y el navegador acababa
 * pintando el alt crudo sobre el velo negro — sin fecha, sin icono de
 * categoría y sin organizador, porque toda la plantilla editorial cuelga de
 * `!posterUrl`. Este hook convierte el fallo de carga en estado, de modo que
 * el componente re-renderiza SIN posterUrl y la plantilla completa vuelve.
 *
 * Vive fuera de `imagenesEvento.js` a propósito: ese módulo lo importa
 * `destacados.js` y debe seguir "limpio" (sin React).
 *
 * Devuelve:
 *   - posterUrl: la url, o null si no hay imagen o si su carga falló
 *   - pos: object-position para el <img>
 *   - onError: handler que hay que enchufar al <img>
 *   - real: true si posterUrl es la foto propia del evento; false si es una
 *     ilustrativa de la galería por categoría (o no hay imagen)
 *   - credito: atribución de la ilustrativa (undefined con foto propia)
 *
 * `opciones` se pasa tal cual a imagenEvento() (p. ej. {paraHeroe: true} en
 * la ficha de detalle, que excluye las variantes de resolución justa).
 */
export function useImagenEvento(evento, opciones) {
  // Tolera `evento` nulo para que quien tenga returns tempranos (EventoDetalle
  // mientras carga) pueda llamar al hook siempre, como exigen las reglas de
  // los hooks, sin romperse al leer `evento.imagen`.
  const img = evento ? imagenEvento(evento, opciones) : null
  const src = img?.src ?? null
  const [rota, setRota] = useState(false)

  // Reset al cambiar de imagen: estos componentes se reutilizan entre items de
  // una lista (React puede conservar la instancia y cambiarle el evento), y un
  // `rota` heredado del anterior escondería un cartel que sí carga.
  useEffect(() => {
    setRota(false)
  }, [src])

  const onError = useCallback(() => setRota(true), [])

  return {
    posterUrl: rota ? null : src,
    pos: img?.pos || '50% 50%',
    onError,
    real: Boolean(img?.real) && !rota,
    credito: img?.real ? undefined : img?.credito,
  }
}
