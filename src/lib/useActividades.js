// Obtiene actividades con plazo de inscripción desde /api/actividades (Neon).
// Filtra las vigentes (fecha_limite >= hoy o sin plazo), ordena por fecha de
// plazo (las que cierren primero primero).
import { useEffect, useMemo, useState } from 'react'
import { hoyISO } from './fechas.js'

export function useActividades() {
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    fetch('/api/actividades')
      .then((r) => (r.ok ? r.json() : { actividades: [] }))
      .then((response) => {
        if (vigente) setDatos(response.actividades ?? [])
      })
      .catch(() => {
        if (vigente) setDatos([])
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [])

  // Actividades vigentes ordenadas por fecha de plazo (ASC = las que cierren
  // primero primero), luego por fecha de publicación descendente.
  const actividades = useMemo(() => {
    const hoy = hoyISO()
    return datos
      .filter((a) => !a.fecha_limite || a.fecha_limite >= hoy)
      .sort((a, b) => {
        // Primero: sin plazo al final (null last)
        if (!a.fecha_limite && !b.fecha_limite) return 0
        if (!a.fecha_limite) return 1
        if (!b.fecha_limite) return -1
        // Con plazo: fecha más cercana primero
        return a.fecha_limite.localeCompare(b.fecha_limite)
      })
  }, [datos])

  // Actividades cuyo plazo caduca en ≤ 7 días (para la franja "Últimos días").
  const proximasACaducar = useMemo(() => {
    const hoy = hoyISO()
    const en7Dias = new Date()
    en7Dias.setDate(en7Dias.getDate() + 7)
    const fechaMax = en7Dias.toISOString().slice(0, 10)

    return actividades
      .filter((a) => a.fecha_limite && a.fecha_limite >= hoy && a.fecha_limite <= fechaMax)
      .sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite))
  }, [actividades])

  return { actividades, proximasACaducar, cargando }
}
