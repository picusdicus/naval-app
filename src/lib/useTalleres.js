import { useEffect, useMemo, useState } from 'react'

/**
 * Talleres publicados (GET /api/talleres). Única vía por la que una página
 * pública debe leer el catálogo, igual que useEventosPublicos con la agenda.
 *
 * A diferencia de los eventos no hay fuentes estáticas que mezclar: los
 * talleres viven solo en Neon, así que aquí no hay merge ni dedup. Si el
 * endpoint falla, la lista queda vacía y la página muestra su estado vacío —
 * el endpoint ya responde 200 con `{talleres: []}` cuando Neon no contesta.
 *
 * La lista se memoiza para que los llamadores puedan usarla como dependencia
 * de useMemo sin recalcular en cada render.
 */
export function useTalleres() {
  const [talleres, setTalleres] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true

    fetch('/api/talleres')
      .then((r) => (r.ok ? r.json() : { talleres: [] }))
      .then((datos) => {
        if (!vigente) return
        setTalleres(datos.talleres ?? [])
        setCargando(false)
      })
      .catch(() => {
        if (!vigente) return
        setTalleres([])
        setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [])

  return useMemo(() => ({ talleres, cargando }), [talleres, cargando])
}
