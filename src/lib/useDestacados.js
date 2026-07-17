import { useEffect, useMemo, useState } from 'react'
import { COMERCIOS_POR_ID, comercioATarjeta, eventoATarjeta } from './destacados.js'

// Resuelve la lista cruda de /api/destacados contra los datos que el cliente
// ya tiene: los comercios (índice de módulo) y los eventos que pase el
// llamador (normalmente los de useEventosPublicos, para no duplicar su fetch;
// con tipo 'comercio' no hacen falta). Las referencias muertas y los eventos
// ya pasados se filtran en silencio — igual que hace proximosEventos.
//
//   const { items, cargando } = useDestacados({ eventos, tipo: 'evento' })
//
// Devuelve TODOS los vigentes ya adaptados a props de <TarjetaDestacado>, en
// el orden que fijó el superadmin (el endpoint ya viene ordenado por `orden`).
// El reparto de huecos no se hace aquí: <CarruselDestacados> muestra una
// ventana de `visibles` que rota en bucle por la lista completa.
export function useDestacados({ eventos = [], tipo = null } = {}) {
  const [crudos, setCrudos] = useState(null) // null mientras carga

  useEffect(() => {
    let vigente = true

    fetch('/api/destacados')
      .then((r) => (r.ok ? r.json() : { destacados: [] }))
      .then((datos) => {
        if (vigente) setCrudos(datos.destacados ?? [])
      })
      .catch(() => {
        if (vigente) setCrudos([])
      })

    return () => {
      vigente = false
    }
  }, [])

  const items = useMemo(() => {
    if (!crudos || crudos.length === 0) return []

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const eventosPorId = new Map(eventos.map((e) => [e.id, e]))

    return crudos
      .filter((d) => !tipo || d.tipo === tipo)
      .map((d) => {
        if (d.tipo === 'comercio') {
          const comercio = COMERCIOS_POR_ID.get(d.referenciaId)
          return comercio ? comercioATarjeta(comercio, d.imagen) : null
        }
        const evento = eventosPorId.get(d.referenciaId)
        if (!evento || new Date(`${evento.fecha}T00:00:00`) < hoy) return null
        return eventoATarjeta(evento, d.imagen)
      })
      .filter(Boolean)
  }, [crudos, eventos, tipo])

  return { items, cargando: crudos === null }
}
