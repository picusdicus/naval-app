import { useCallback, useEffect, useMemo, useState } from 'react'
import { interseca } from './temasPush.js'
import {
  prefsLocales,
  haySuscripcionReal,
  avisosLeidos,
  avisosOcultos,
  guardarLeidos,
  guardarOcultos,
  vistoLegacy,
  limpiarVistoLegacy,
} from './push.js'

// Lee el historial de avisos (GET /api/avisos) y lo filtra CLIENT-SIDE por los
// temas del dispositivo, igual que useDestacados filtra los destacados. SIN
// suscripción la bandeja va vacía: un dispositivo que no ha activado los
// avisos no debe ver "notificaciones" que nadie le ha enviado (el feed sigue
// siendo público en /api/avisos, esto es solo presentación). El estado
// leído/oculto es POR DISPOSITIVO (localStorage): las suscripciones son
// anónimas, no hay estado de lectura en Neon. "Borrar" oculta el aviso solo en
// este aparato; el feed global no se toca.

export function useAvisos() {
  const [todos, setTodos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [leidos, setLeidos] = useState(() => new Set(avisosLeidos()))
  const [ocultos, setOcultos] = useState(() => new Set(avisosOcultos()))
  // La suscripción real del navegador cubre el caso "localStorage borrado pero
  // el aparato sigue suscrito" (misma robustez que DialogoAvisos).
  const [suscripcionReal, setSuscripcionReal] = useState(false)

  useEffect(() => {
    let vigente = true
    haySuscripcionReal().then((hay) => {
      if (vigente) setSuscripcionReal(hay)
    })
    return () => {
      vigente = false
    }
  }, [])

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

  // Se relee en cada render a propósito: al activar los avisos desde el
  // diálogo de gestión (sin recargar), el cierre re-renderiza y esto se actualiza.
  const prefs = prefsLocales()
  const suscrito = Boolean(prefs) || suscripcionReal

  // Visibles: solo con suscripción, no ocultos + coincidentes con los temas del
  // aparato (todos si hay suscripción real pero se perdió la copia de temas).
  const avisos = useMemo(() => {
    if (!suscrito) return []
    const base = todos.filter((a) => !ocultos.has(a.referencia_id))
    const porTema = prefs ? base.filter((a) => interseca(prefs, a.temas || [])) : base
    return porTema.map((a) => ({ ...a, leido: leidos.has(a.referencia_id) }))
  }, [todos, ocultos, leidos, prefs, suscrito])

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
    suscrito,
    cargando,
    marcarLeido,
    marcarNoLeido,
    marcarTodasLeidas,
    borrar,
    borrarTodas,
  }
}
