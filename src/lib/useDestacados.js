import { useEffect, useMemo, useState } from 'react'
import { COMERCIOS_POR_ID, comercioATarjeta, eventoATarjeta, tallerATarjeta } from './destacados.js'

// Resuelve la lista cruda de /api/destacados contra los datos que el cliente
// ya tiene: los comercios (índice de módulo) y los eventos que pase el
// llamador (normalmente los de useEventosPublicos, para no duplicar su fetch;
// con tipo 'comercio' no hacen falta). Las referencias muertas y los eventos
// ya pasados se filtran en silencio — igual que hace proximosEventos.
//
//   const { items, cargando } = useDestacados({ eventos, tipo: 'evento' })
//   const { items } = useDestacados({ talleres, tipo: 'taller' })
//
// Devuelve TODOS los vigentes ya adaptados a props de <TarjetaDestacado>, en
// el orden que fijó el superadmin (el endpoint ya viene ordenado por `orden`).
// El reparto de huecos no se hace aquí: <CarruselDestacados> muestra una
// ventana de `visibles` que rota en bucle por la lista completa.
export function useDestacados({ eventos = [], talleres = [], tipo = null } = {}) {
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
    // Un evento fusionado por combinarEventos responde también por los ids de
    // sus duplicados (una referencia de destacado puede apuntar al 'bd-…').
    const eventosPorId = new Map(
      eventos.flatMap((e) => [[e.id, e], ...(e.idsSecundarios || []).map((s) => [s, e])])
    )

    const talleresPorId = new Map(talleres.map((t) => [t.id, t]))

    return crudos
      .filter((d) => !tipo || d.tipo === tipo)
      .map((d) => {
        // Un taller no caduca por fecha: mientras siga publicado (y por tanto
        // en la lista que pasa el llamador) su destacado está en vigor. El
        // corte temporal lo pone la vigencia de la propia campaña, que ya
        // aplicó el endpoint.
        if (d.tipo === 'taller') {
          const taller = talleresPorId.get(d.referenciaId)
          return taller ? tallerATarjeta(taller, { imagenOverride: d.imagen }) : null
        }
        if (d.tipo === 'comercio') {
          const comercio = COMERCIOS_POR_ID.get(d.referenciaId)
          return comercio ? comercioATarjeta(comercio, d.imagen) : null
        }
        const evento = eventosPorId.get(d.referenciaId)
        if (!evento || new Date(`${evento.fecha}T00:00:00`) < hoy) return null
        return eventoATarjeta(evento, { imagenOverride: d.imagen })
      })
      .filter(Boolean)
  }, [crudos, eventos, talleres, tipo])

  return { items, cargando: crudos === null }
}
