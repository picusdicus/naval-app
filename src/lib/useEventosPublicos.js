import { useEffect, useMemo, useState } from 'react'
import eventosCurados from '../data/eventos.json'
import eventosExternos from '../data/eventos-externos.json'
import {
  aplicarFusionesManuales,
  combinarEventos,
  enriquecerPorCartel,
  propagarCartelDeSerie,
} from './dedupEventos.js'

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
  const [fusiones, setFusiones] = useState([])
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

    // Fusiones manuales del superadmin (issue #27). Falla suave: si no
    // responde, no se aplica ninguna y la agenda muestra las tarjetas sueltas.
    fetch('/api/fusiones-eventos')
      .then((r) => (r.ok ? r.json() : { fusiones: [] }))
      .then((datos) => {
        if (vigente) setFusiones(datos.fusiones ?? [])
      })
      .catch(() => {})

    return () => {
      vigente = false
    }
  }, [])

  // Convierte actividades a eventos con su categoría real de Neon (el CHECK de
  // la tabla coincide con CATEGORIAS_EVENTO, ver src/lib/eventos.js).
  // Usa fecha_evento (cuándo se celebra) como fecha principal, no fecha_limite (plazo).
  const eventosDeActividades = useMemo(() => {
    return actividades
      .filter((a) => a.fecha_evento || a.fecha_limite) // Al menos una fecha conocida
      .map((a) => ({
        id: a.id,
        titulo: a.titulo,
        // Prioridad: fecha_evento (cuándo se celebra) > fecha_limite (plazo)
        fecha: a.fecha_evento || a.fecha_limite,
        hora: a.horario,
        lugar: a.lugar,
        categoria: a.categoria,
        descripcion: a.descripcion || '',
        imagen: a.imagen_url,
        url: a.url_fuente,
        origen: 'actividad',
        // Metadatos adicionales para UI
        fechaEvento: a.fecha_evento,
        fechaLimite: a.fecha_limite,
        publicadoEn: a.publicado_en,
      }))
  }, [actividades])

  // Identidad estable mientras no lleguen datos nuevos: quien reciba `eventos`
  // puede usarlo como dependencia de un useMemo sin recalcular en cada render.
  // enriquecerPorCartel filtra los carteles que enriquecen eventos del programa
  // por ID directo (inyectando imagen) y los quita de la lista de retorno.
  // combinarEventos después fusiona los duplicados (evento curado + el mismo evento
  // creado en Neon por el scrapper de Instagram) en una sola tarjeta; después
  // se descartan los que el superadmin haya ocultado (por id principal o por
  // cualquiera de los idsSecundarios que la fusión haya acumulado).
  // Las fusiones manuales del superadmin se aplican como ÚLTIMO paso del
  // merge, después del matcher automático (así no perturban sus decisiones y
  // una fila que el matcher ya resuelve solo queda en no-op); el filtro de
  // ocultos va detrás para que ocultar por cualquiera de los ids fusionados
  // siga funcionando.
  const eventos = useMemo(() => {
    const estaticosEnriquecidos = enriquecerPorCartel(ESTATICOS)
    // propagarCartelDeSerie va al final: un acto de varios días recibe el
    // cartel por una sola de sus fechas (la Gala de la Danza del 2 y 3 de
    // septiembre se anuncia con un único cartel fechado el día 2), y los demás
    // días se quedaban sin él. Después de las fusiones para aprovechar también
    // las imágenes que llegan por ahí.
    const combinados = propagarCartelDeSerie(
      aplicarFusionesManuales(
        combinarEventos(estaticosEnriquecidos, [...deLaBase, ...eventosDeActividades]),
        fusiones,
      ),
    )
    if (!ocultos.size) return combinados
    return combinados.filter(
      (e) => !ocultos.has(e.id) && !(e.idsSecundarios || []).some((id) => ocultos.has(id)),
    )
  }, [deLaBase, eventosDeActividades, ocultos, fusiones])

  return { eventos, cargando }
}
