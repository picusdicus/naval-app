// Une las dos fuentes de noticias en una sola lista ordenada: el RSS de
// prensa del Ayuntamiento (noticias.json, estático) y las sincronizadas desde
// su Instagram (GET /api/noticias-instagram, Neon). Mismo patrón que
// useEventosPublicos: las estáticas están desde el primer render y la lista
// nunca se rompe si la API falla. Sin dedup RSS↔Instagram a propósito: la
// misma noticia publicada en ambos canales puede salir dos veces (ids
// distintos, no rompe nada) — revisar solo si en la práctica resulta ruidoso.
//
// `noticias` se limita al último mes (el RSS arrastra items muy antiguos).
// `alertas` son las urgentes vigentes (urgente + expiraEn > ahora), filtradas
// aquí en cliente — no hay cron: al caducar dejan de aparecer. Solo pueden
// venir de Instagram (el RSS no marca urgencia) y no dependen del corte de un mes.
import { useEffect, useMemo, useState } from 'react'
import noticiasRss from '../data/noticias.json'
import { hoyISO } from './fechas.js'

export const ETIQUETAS_ALERTA = {
  incendio: 'Incendio',
  corte_agua: 'Corte de agua',
  corte_luz: 'Corte de luz',
  trafico: 'Tráfico',
  emergencia: 'Emergencia',
  general: 'Aviso',
}

// Categorías de actividad (misma whitelist que api/sync-instagram-noticias.js
// y el CHECK de la tabla). El orden decide el de los chips de /actividades.
export const ETIQUETAS_ACTIVIDAD = {
  deporte: 'Deporte',
  talleres: 'Talleres y cursos',
  infantil: 'Infantil',
  mayores: 'Mayores',
  educacion: 'Educación',
  ayudas: 'Ayudas y becas',
  empleo: 'Empleo',
  general: 'General',
}

const ESTATICAS = [...noticiasRss]

// Solo se muestran noticias del último mes: el RSS de prensa arrastra items
// antiguos (hasta de años atrás) que ensucian el listado. Fecha límite en
// formato YYYY-MM-DD para comparar directamente con `fecha`. Los avisos
// urgentes vigentes se calculan aparte y no dependen de este corte.
function fechaLimiteUnMes() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

export function useNoticiasPublicas() {
  const [deLaBase, setDeLaBase] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    Promise.all([
      fetch('/api/noticias-instagram')
        .then((r) => (r.ok ? r.json() : { noticias: [] }))
        .catch(() => ({ noticias: [] })),
      fetch('/api/actividades')
        .then((r) => (r.ok ? r.json() : { actividades: [] }))
        .catch(() => ({ actividades: [] })),
    ])
      .then(([noticias, actividades]) => {
        if (vigente) {
          const actividadesConTipo = (actividades.actividades ?? []).map((a) => ({
            ...a,
            tipo: 'actividad',
            fecha: a.publicado_en,
            fechaLimite: a.fecha_limite,
          }))
          setDeLaBase([...(noticias.noticias ?? []), ...actividadesConTipo])
        }
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

  // Mezcla RSS + Instagram, descarta lo de más de un mes y ordena por fecha
  // descendente (sin el sort, las de Instagram quedarían detrás del RSS).
  // Las actividades (tipo 'actividad') no son noticias: viven en /actividades.
  const noticias = useMemo(() => {
    const limite = fechaLimiteUnMes()
    return [...ESTATICAS, ...deLaBase]
      .filter((n) => n.tipo !== 'actividad')
      .filter((n) => (n.fecha || '') >= limite)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  }, [deLaBase])

  // Actividades con el plazo abierto (o sin plazo conocido, mientras sigan en
  // la ventana de historial del GET), lo último publicado primero — como las
  // noticias. La urgencia de plazo no se ordena aquí: la página Actividades
  // destaca aparte las que caducan pronto en su franja "Últimos días". Al
  // pasar fecha_limite desaparecen solas, sin cron.
  const actividades = useMemo(() => {
    const hoy = hoyISO()
    return deLaBase
      .filter((n) => n.tipo === 'actividad' && (!n.fechaLimite || n.fechaLimite >= hoy))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  }, [deLaBase])

  // Avisos del municipio: las urgentes vigentes (urgente + no caducadas).
  // Filtro client-side, sin cron: al pasar `expiraEn` dejan de aparecer.
  // Alimentan la sección "Avisos" de la portada (Inicio) y de Noticias; el
  // listado general de Noticias las excluye para no duplicarlas.
  const alertas = useMemo(() => {
    const ahora = Date.now()
    return deLaBase.filter((n) => n.urgente && n.expiraEn && Date.parse(n.expiraEn) > ahora)
  }, [deLaBase])

  return { noticias, actividades, alertas, cargando }
}
