import { useEffect, useState } from 'react'
import { CATEGORIAS_EVENTO, formatearFechaCorta } from '../../../lib/eventos.js'
import { ETIQUETAS_ACTIVIDAD } from '../../../lib/useNoticiasPublicas.js'
import MIcon from '../../MIcon.jsx'

// Tab "Pendientes" del panel superadmin: valida lo que la sincronización de
// Instagram extrajo de programaciones enlazadas (PDF de agenda, galerías) y
// dejó en borrador — nada de esto es visible en la app hasta publicarlo.
// Publicar un evento lo deja además con notificado_en NULL, así que el digest
// push del cron lo anuncia como a cualquier otro. Descartar archiva (no
// borra): el upsert del webhook no toca `estado`, un descartado no resucita.

function etiquetaCategoria(item, tipo) {
  if (tipo === 'evento') return CATEGORIAS_EVENTO[item.categoria]?.nombre || item.categoria
  return ETIQUETAS_ACTIVIDAD[item.categoria] || item.categoria
}

export default function TablesPendientes() {
  const [eventos, setEventos] = useState([])
  const [actividades, setActividades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [ocupadoId, setOcupadoId] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    let vigente = true
    fetch('/api/super/pendientes')
      .then((r) => (r.ok ? r.json() : { eventos: [], actividades: [] }))
      .then((datos) => {
        if (!vigente) return
        setEventos(datos.eventos ?? [])
        setActividades(datos.actividades ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [])

  async function resolverItem(tipo, item, publicar) {
    setOcupadoId(item.id)
    setMensaje(null)
    try {
      const respuesta = await fetch(
        `/api/super/pendientes?tipo=${tipo}&id=${item.id}`,
        { method: publicar ? 'PATCH' : 'DELETE' }
      )
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(datos.error || 'No se pudo resolver el elemento.')
      }
      if (tipo === 'evento') setEventos((previos) => previos.filter((e) => e.id !== item.id))
      else setActividades((previos) => previos.filter((a) => a.id !== item.id))
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  function Fila({ item, tipo }) {
    const ocupado = ocupadoId === item.id
    const meta = [
      tipo === 'evento'
        ? `${formatearFechaCorta(item.fecha)}${item.hora ? `, ${item.hora}` : ''}`
        : item.fechaLimite
          ? `Plazo hasta ${formatearFechaCorta(item.fechaLimite)}`
          : 'Sin plazo',
      item.lugar,
      etiquetaCategoria(item, tipo),
    ].filter(Boolean)
    return (
      <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif-dm text-base leading-tight text-tinta">{item.titulo}</p>
          <p className="mt-0.5 truncate font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
            {meta.join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 border border-filete px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo transition-colors hover:text-tinta"
              title="Ver la fuente original"
            >
              <MIcon name="open_in_new" className="text-[14px]" />
              Fuente
            </a>
          )}
          <button
            type="button"
            onClick={() => resolverItem(tipo, item, true)}
            disabled={ocupado}
            className="inline-flex items-center gap-1 border border-verde bg-papel px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-verde transition-colors hover:bg-verde hover:text-papel disabled:opacity-40"
          >
            <MIcon name="check" className="text-[14px]" />
            Publicar
          </button>
          <button
            type="button"
            onClick={() => resolverItem(tipo, item, false)}
            disabled={ocupado}
            className="inline-flex items-center gap-1 border border-filete px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo transition-colors hover:border-terracota hover:text-terracota disabled:opacity-40"
          >
            <MIcon name="close" className="text-[14px]" />
            Descartar
          </button>
        </div>
      </div>
    )
  }

  const total = eventos.length + actividades.length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif-dm text-xl text-tinta">Pendientes de validar</h2>
        <p className="mt-1 font-serif-spectral text-sm text-pardo">
          Eventos y actividades extraídos automáticamente de programaciones enlazadas en
          Instagram (agendas en PDF, galerías). Nada es visible en la app hasta que lo
          publiques; al publicar un evento, el aviso push sale con el próximo digest diario.
          Descartar lo archiva y no volverá a aparecer aunque se repita la sincronización.
        </p>
      </div>

      {mensaje && (
        <p className="flex items-start gap-2 border border-terracota bg-terracota-fondo px-4 py-3 font-serif-spectral text-sm text-terracota">
          <MIcon name="error" className="mt-0.5 text-[18px]" />
          <span>{mensaje.texto}</span>
        </p>
      )}

      {cargando ? (
        <p className="gz-label text-mudo">Cargando pendientes…</p>
      ) : total === 0 ? (
        <p className="border border-dashed border-filete-punteado p-8 text-center font-serif-spectral text-sm text-pardo">
          No hay nada pendiente de validar. La próxima sincronización que extraiga una
          programación te avisará por email.
        </p>
      ) : (
        <>
          {eventos.length > 0 && (
            <section>
              <h3 className="gz-label text-tinta">Eventos ({eventos.length})</h3>
              <div className="mt-2 divide-y divide-filete border-t border-tinta">
                {eventos.map((e) => (
                  <Fila key={e.id} item={e} tipo="evento" />
                ))}
              </div>
            </section>
          )}
          {actividades.length > 0 && (
            <section>
              <h3 className="gz-label text-tinta">Actividades ({actividades.length})</h3>
              <div className="mt-2 divide-y divide-filete border-t border-tinta">
                {actividades.map((a) => (
                  <Fila key={a.id} item={a} tipo="actividad" />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
