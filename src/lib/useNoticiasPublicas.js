// Une las dos fuentes de noticias en una sola lista ordenada: el RSS de
// prensa del Ayuntamiento (noticias.json, estático) y las sincronizadas desde
// su Instagram (GET /api/noticias-instagram, Neon). Mismo patrón que
// useEventosPublicos: las estáticas están desde el primer render y la lista
// nunca se rompe si la API falla. Sin dedup RSS↔Instagram a propósito: la
// misma noticia publicada en ambos canales puede salir dos veces (ids
// distintos, no rompe nada) — revisar solo si en la práctica resulta ruidoso.
//
// `alertas` son las urgentes vigentes (urgente + expiraEn > ahora), filtradas
// aquí en cliente — no hay cron: al caducar dejan de aparecer. Solo pueden
// venir de Instagram (el RSS no marca urgencia).
import { useEffect, useMemo, useState } from 'react'
import noticiasRss from '../data/noticias.json'

export const ETIQUETAS_ALERTA = {
  incendio: 'Incendio',
  corte_agua: 'Corte de agua',
  corte_luz: 'Corte de luz',
  trafico: 'Tráfico',
  emergencia: 'Emergencia',
  general: 'Aviso',
}

const ESTATICAS = [...noticiasRss]

export function useNoticiasPublicas() {
  const [deLaBase, setDeLaBase] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    fetch('/api/noticias-instagram')
      .then((r) => (r.ok ? r.json() : { noticias: [] }))
      .then((datos) => {
        if (vigente) setDeLaBase(datos.noticias ?? [])
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

  // Orden por fecha descendente: sin él, las de Instagram quedarían siempre
  // detrás del RSS y el slice(0, 6) de la página Noticias no las mostraría.
  const noticias = useMemo(
    () =>
      [...ESTATICAS, ...deLaBase].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
    [deLaBase]
  )

  const alertas = useMemo(() => {
    const ahora = Date.now()
    return deLaBase.filter((n) => n.urgente && n.expiraEn && Date.parse(n.expiraEn) > ahora)
  }, [deLaBase])

  return { noticias, alertas, cargando }
}
