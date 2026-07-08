import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// Gestión de scroll entre páginas:
//   - Al volver a la lista de eventos (/eventos) desde el detalle de un evento
//     (/eventos/:id), se restaura la posición de scroll que el usuario tenía,
//     para que no pierda su sitio en la lista. Funciona tanto con el botón
//     "atrás" del navegador como con el enlace "Volver a eventos".
//   - En cualquier otra navegación (cambiar de página) el scroll va al top.
//
// Guarda la posición de scroll de /eventos mientras el usuario está en ella y
// la reaplica al regresar desde un detalle. No mantiene histórico de otras
// rutas: solo la lista de eventos restaura scroll.
const RUTA_LISTA = '/eventos'
const esDetalleEvento = (path) => /^\/eventos\/[^/]+$/.test(path)

export default function ScrollManager() {
  const location = useLocation()
  const posListaRef = useRef(null) // scrollY guardado de la lista de eventos
  const pathAnteriorRef = useRef(location.pathname)

  // Tomamos el control del scroll: evitamos que el navegador restaure por su
  // cuenta al usar "atrás" (competiría con nuestra restauración).
  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return
    const previo = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previo
    }
  }, [])

  // Mientras el usuario está en la lista, registramos su scroll para tenerlo
  // listo cuando navegue al detalle.
  useEffect(() => {
    if (location.pathname !== RUTA_LISTA) return
    const onScroll = () => {
      posListaRef.current = window.scrollY
    }
    posListaRef.current = window.scrollY
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [location.pathname])

  useLayoutEffect(() => {
    const path = location.pathname
    const veniaDeDetalle = esDetalleEvento(pathAnteriorRef.current)

    // Volver a la lista desde un detalle: restaurar la posición previa (si la
    // hay). Cualquier otra navegación va al top.
    const destino =
      path === RUTA_LISTA && veniaDeDetalle && posListaRef.current != null
        ? posListaRef.current
        : 0

    // 'instant' evita la animación de `scroll-behavior: smooth` (CSS), para que
    // el salto sea inmediato y preciso (sin quedarse a medias).
    window.scrollTo({ top: destino, left: 0, behavior: 'instant' })
    // Re-aplica tras el layout final (por si la altura aún no era definitiva y
    // el primer scroll quedó recortado).
    const raf = requestAnimationFrame(() =>
      window.scrollTo({ top: destino, left: 0, behavior: 'instant' }),
    )

    pathAnteriorRef.current = path
    return () => cancelAnimationFrame(raf)
  }, [location])

  return null
}
