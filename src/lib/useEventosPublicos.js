import { useEffect, useMemo, useState } from 'react'
import eventosCurados from '../data/eventos.json'
import eventosExternos from '../data/eventos-externos.json'
import { combinarEventos } from './dedupEventos.js'

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
  const [ocultos, setOcultos] = useState(() => new Set())
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

    // Lista de ids ocultados por el superadmin. Falla suave: si no responde,
    // no se oculta nada (la agenda se muestra completa).
    fetch('/api/eventos-ocultos')
      .then((r) => (r.ok ? r.json() : { ocultos: [] }))
      .then((datos) => {
        if (vigente) setOcultos(new Set(datos.ocultos ?? []))
      })
      .catch(() => {})

    return () => {
      vigente = false
    }
  }, [])

  // Identidad estable mientras no lleguen datos nuevos: quien reciba `eventos`
  // puede usarlo como dependencia de un useMemo sin recalcular en cada render.
  // combinarEventos fusiona los duplicados (evento curado + el mismo evento
  // creado en Neon por el scrapper de Instagram) en una sola tarjeta; después
  // se descartan los que el superadmin haya ocultado (por id principal o por
  // cualquiera de los idsSecundarios que la fusión haya acumulado).
  const eventos = useMemo(() => {
    const combinados = combinarEventos(ESTATICOS, deLaBase)
    if (!ocultos.size) return combinados
    return combinados.filter(
      (e) => !ocultos.has(e.id) && !(e.idsSecundarios || []).some((id) => ocultos.has(id)),
    )
  }, [deLaBase, ocultos])

  return { eventos, cargando }
}
