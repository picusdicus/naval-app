import { useEffect, useMemo, useState } from 'react'
import eventosCurados from '../data/eventos.json'
import eventosExternos from '../data/eventos-externos.json'
import { combinarEventos } from './dedupEventos.js'

// La agenda pública combina tres orígenes: los JSON estáticos (curados y
// sincronizados desde fuentes externas), los eventos que las organizaciones
// publican desde /admin (que viven en Neon), y las actividades con plazo
// de inscripción (también de Neon). Los borradores no salen de ahí:
// /api/eventos solo devuelve los que están en estado 'publicado'.

const ESTATICOS = [...eventosCurados, ...eventosExternos]

/**
 * Devuelve { eventos, cargando }. Los eventos estáticos están disponibles en el
 * primer render, así que la agenda nunca aparece vacía mientras carga la base
 * de datos, y si /api/eventos falla se sigue mostrando el JSON.
 */
export function useEventosPublicos() {
  const [deLaBase, setDeLaBase] = useState([])
  const [actividades, setActividades] = useState([])
  const [ocultos, setOcultos] = useState(() => new Set())
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true

    Promise.all([
      fetch('/api/eventos')
        .then((r) => (r.ok ? r.json() : { eventos: [] }))
        .catch(() => ({ eventos: [] })),
      fetch('/api/actividades')
        .then((r) => (r.ok ? r.json() : { actividades: [] }))
        .catch(() => ({ actividades: [] })),
    ])
      .then(([eventosResp, actividadesResp]) => {
        if (vigente) {
          setDeLaBase(eventosResp.eventos ?? [])
          setActividades(actividadesResp.actividades ?? [])
        }
      })
      .catch(() => {
        if (vigente) {
          setDeLaBase([])
          setActividades([])
        }
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

  // Convierte actividades a eventos con categoría 'talleres'.
  // Nota: usa fecha_limite como fecha principal (cuándo es la actividad/plazo)
  // no publicado_en (cuándo se publicó en Instagram).
  const eventosDeActividades = useMemo(() => {
    return actividades
      .filter((a) => a.fecha_limite) // Solo actividades con plazo conocido
      .map((a) => ({
        id: a.id,
        titulo: a.titulo,
        fecha: a.fecha_limite, // Fecha límite de inscripción = fecha del evento
        hora: a.horario,
        lugar: a.lugar,
        categoria: 'talleres',
        descripcion: a.descripcion || '',
        imagen: a.imagen_url,
        url: a.url_fuente,
        origen: 'actividad',
        // Metadatos adicionales
        fechaLimite: a.fecha_limite,
        publicadoEn: a.publicado_en,
      }))
  }, [actividades])

  // Identidad estable mientras no lleguen datos nuevos: quien reciba `eventos`
  // puede usarlo como dependencia de un useMemo sin recalcular en cada render.
  // combinarEventos fusiona los duplicados (evento curado + el mismo evento
  // creado en Neon por el scrapper de Instagram) en una sola tarjeta; después
  // se descartan los que el superadmin haya ocultado (por id principal o por
  // cualquiera de los idsSecundarios que la fusión haya acumulado).
  const eventos = useMemo(() => {
    const combinados = combinarEventos(ESTATICOS, [...deLaBase, ...eventosDeActividades])
    if (!ocultos.size) return combinados
    return combinados.filter(
      (e) => !ocultos.has(e.id) && !(e.idsSecundarios || []).some((id) => ocultos.has(id)),
    )
  }, [deLaBase, eventosDeActividades, ocultos])

  return { eventos, cargando }
}
