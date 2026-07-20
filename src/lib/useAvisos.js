import { useEffect, useMemo, useState } from 'react'
import { interseca } from './temasPush.js'
import { prefsLocales, vistoLocal } from './push.js'

// Lee el historial de avisos (GET /api/avisos) y lo filtra CLIENT-SIDE por los
// temas del dispositivo, igual que useDestacados filtra los destacados: una
// respuesta cacheable para todos, y el navegador ya sabe a qué está suscrito.
//
// Sin suscripción hecha desde este dispositivo (prefsLocales === null) la
// bandeja muestra todas las novedades: es un feed público, no hay nada privado.
// El contador de "no leídos" compara enviado_en contra la última visita
// (vistoLocal), que se refresca al abrir la bandeja.

export function useAvisos() {
  const [todos, setTodos] = useState([])
  const [cargando, setCargando] = useState(true)
  // Se recalcula al abrir/cerrar la bandeja para refrescar el "no leído".
  const [visto, setVisto] = useState(() => vistoLocal())

  useEffect(() => {
    let vigente = true
    fetch('/api/avisos')
      .then((r) => (r.ok ? r.json() : { avisos: [] }))
      .then((datos) => {
        if (vigente) setTodos(datos.avisos ?? [])
      })
      .catch(() => {
        if (vigente) setTodos([])
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [])

  const prefs = prefsLocales()

  const avisos = useMemo(() => {
    if (!prefs) return todos
    return todos.filter((a) => interseca(prefs, a.temas || []))
  }, [todos, prefs])

  const noLeidos = useMemo(
    () => avisos.filter((a) => !visto || a.enviado_en > visto).length,
    [avisos, visto],
  )

  // Llamar tras marcarVisto() para que el badge baje a 0 sin recargar.
  const refrescarVisto = () => setVisto(vistoLocal())

  return { avisos, noLeidos, cargando, refrescarVisto }
}
