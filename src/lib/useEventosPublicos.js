import { useEffect, useMemo, useState } from 'react'
import eventosCurados from '../data/eventos.json'
import eventosExternos from '../data/eventos-externos.json'

// La agenda pública combina dos orígenes: los JSON estáticos (curados y
// sincronizados desde fuentes externas) y los eventos que las organizaciones
// publican desde /admin, que viven en Neon. Los borradores no salen de ahí:
// /api/eventos solo devuelve los que están en estado 'publicado'.

const ESTATICOS = [...eventosCurados, ...eventosExternos]

/**
 * Devuelve { eventos, cargando }. Los eventos estáticos están disponibles en el
 * primer render, así que la agenda nunca aparece vacía mientras carga la base
 * de datos, y si /api/eventos falla se sigue mostrando el JSON.
 */
export function useEventosPublicos() {
  const [deLaBase, setDeLaBase] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true

    fetch('/api/eventos')
      .then((r) => (r.ok ? r.json() : { eventos: [] }))
      .then((datos) => {
        if (vigente) setDeLaBase(datos.eventos ?? [])
      })
      .catch(() => {
        if (vigente) setDeLaBase([])
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [])

  // Identidad estable mientras no lleguen datos nuevos: quien reciba `eventos`
  // puede usarlo como dependencia de un useMemo sin recalcular en cada render.
  const eventos = useMemo(() => [...ESTATICOS, ...deLaBase], [deLaBase])

  return { eventos, cargando }
}
