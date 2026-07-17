import { useEffect, useMemo, useState } from 'react'
import { COMERCIOS_POR_ID, comercioATarjeta, eventoATarjeta } from './destacados.js'

// Resuelve la lista cruda de /api/destacados contra los datos que el cliente
// ya tiene: los comercios (índice de módulo) y los eventos que pase el
// llamador (normalmente los de useEventosPublicos, para no duplicar su fetch;
// con tipo 'comercio' no hacen falta). Las referencias muertas y los eventos
// ya pasados se filtran en silencio — igual que hace proximosEventos.
//
//   const { items, cargando } = useDestacados({ eventos, tipo: 'evento', limite: 3 })
//
// Devuelve items ya adaptados a props de <TarjetaDestacado>. Si los vigentes
// caben en `limite`, en el orden que fijó el superadmin (el endpoint ya viene
// ordenado por `orden`); si hay más que huecos, cada montaje sortea cuáles se
// muestran (semilla estable por montaje, para que la selección no baile entre
// re-renders) y re-ordena la selección por ese mismo `orden` — así todos los
// contratados rotan por los huecos sin perder su prioridad relativa.
export function useDestacados({ eventos = [], tipo = null, limite } = {}) {
  const [crudos, setCrudos] = useState(null) // null mientras carga
  const [semilla] = useState(() => Math.random())

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

    const resueltos = crudos
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

    if (typeof limite !== 'number' || resueltos.length <= limite) return resueltos

    // Más contratados que huecos: se sortean `limite` y se restaura el orden
    // original (índice) dentro de la selección para respetar la prioridad.
    const indexados = resueltos.map((item, i) => ({ item, i }))
    return barajarConSemilla(indexados, semilla)
      .slice(0, limite)
      .sort((a, b) => a.i - b.i)
      .map(({ item }) => item)
  }, [crudos, eventos, tipo, limite, semilla])

  return { items, cargando: crudos === null }
}

// PRNG determinista minúsculo: misma semilla → misma secuencia, para que el
// sorteo no cambie cuando el useMemo recomputa (p. ej. al llegar los eventos).
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates sembrado con un número en [0, 1). No muta la lista. */
export function barajarConSemilla(lista, semilla) {
  const azar = mulberry32(Math.floor(semilla * 2 ** 32))
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}
