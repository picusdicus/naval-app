import { useCallback, useEffect, useMemo, useState } from 'react'
import { interseca } from './temasPush.js'
import {
  prefsLocales,
  avisosLeidos,
  avisosOcultos,
  guardarLeidos,
  guardarOcultos,
  vistoLegacy,
  limpiarVistoLegacy,
} from './push.js'

// Lee el historial de avisos (GET /api/avisos) y lo filtra CLIENT-SIDE por los
// temas del dispositivo, igual que useDestacados filtra los destacados. El
// estado leído/oculto es POR DISPOSITIVO (localStorage): las suscripciones son
// anónimas, no hay estado de lectura en Neon. "Borrar" oculta el aviso solo en
// este aparato; el feed global no se toca.

export function useAvisos() {
  const [todos, setTodos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [leidos, setLeidos] = useState(() => new Set(avisosLeidos()))
  const [ocultos, setOcultos] = useState(() => new Set(avisosOcultos()))

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

  // Al llegar el feed: migrar la primera versión (avisos anteriores a la última
  // visita → leídos) y podar de localStorage los ids que ya no están en el feed.
  useEffect(() => {
    if (!todos.length) return
    const idsVigentes = new Set(todos.map((a) => a.referencia_id))
    const visto = vistoLegacy()

    setLeidos((prev) => {
      const next = new Set([...prev].filter((id) => idsVigentes.has(id)))
      if (visto) {
        for (const a of todos) if (a.enviado_en <= visto) next.add(a.referencia_id)
      }
      guardarLeidos([...next])
      return next
    })
    setOcultos((prev) => {
      const next = new Set([...prev].filter((id) => idsVigentes.has(id)))
      guardarOcultos([...next])
      return next
    })
    if (visto) limpiarVistoLegacy()
  }, [todos])

  const prefs = prefsLocales()

  // Visibles: no ocultos + coinciden con los temas del aparato (o todos si no
  // hay suscripción hecha aquí: es un feed público, no hay nada privado).
  const avisos = useMemo(() => {
    const base = todos.filter((a) => !ocultos.has(a.referencia_id))
    const porTema = prefs ? base.filter((a) => interseca(prefs, a.temas || [])) : base
    return porTema.map((a) => ({ ...a, leido: leidos.has(a.referencia_id) }))
  }, [todos, ocultos, leidos, prefs])

  const noLeidos = useMemo(() => avisos.filter((a) => !a.leido).length, [avisos])

  const marcarLeido = useCallback((id) => {
    setLeidos((prev) => {
      const next = new Set(prev)
      next.add(id)
      guardarLeidos([...next])
      return next
    })
  }, [])

  const marcarNoLeido = useCallback((id) => {
    setLeidos((prev) => {
      const next = new Set(prev)
      next.delete(id)
      guardarLeidos([...next])
      return next
    })
  }, [])

  const marcarTodasLeidas = useCallback(() => {
    setLeidos((prev) => {
      const next = new Set(prev)
      for (const a of avisos) next.add(a.referencia_id)
      guardarLeidos([...next])
      return next
    })
  }, [avisos])

  const borrar = useCallback((id) => {
    setOcultos((prev) => {
      const next = new Set(prev)
      next.add(id)
      guardarOcultos([...next])
      return next
    })
  }, [])

  const borrarTodas = useCallback(() => {
    setOcultos((prev) => {
      const next = new Set(prev)
      for (const a of avisos) next.add(a.referencia_id)
      guardarOcultos([...next])
      return next
    })
  }, [avisos])

  return {
    avisos,
    noLeidos,
    cargando,
    marcarLeido,
    marcarNoLeido,
    marcarTodasLeidas,
    borrar,
    borrarTodas,
  }
}
