import { useEffect, useMemo, useState } from 'react'
import eventosCurados from '../../../data/eventos.json'
import eventosExternos from '../../../data/eventos-externos.json'
import { combinarEventos, fuenteDeIngesta } from '../../../lib/dedupEventos.js'
import { CATEGORIAS_EVENTO, formatearFechaCorta, formatearFechaLarga } from '../../../lib/eventos.js'
import { hoyISO, sumarDias, diasHasta } from '../../../lib/fechas.js'
import { cartelDe } from '../../../lib/gaceta.js'
import { useImagenEvento } from '../../../lib/useImagenEvento.js'
import MIcon from '../../MIcon.jsx'
import { IconoCategoriaTabler } from '../../eventos/iconosEvento.jsx'

// Tab "Eventos" del panel superadmin: lista todos los eventos publicados de la
// agenda (los tres orígenes ya fusionados con combinarEventos, como la vista
// pública) y permite, con un clic:
//   · Destacar / quitar destacado — crea o borra una fila en `destacados`
//     (tipo evento) vía /api/super/destacados. El destacado nace activo con la
//     duración por defecto (DIAS_DESTACADO); su vigencia/orden se afina luego
//     en el tab Destacados.
//   · Ocultar / mostrar — guarda el id público en `eventos_ocultos` vía
//     /api/super/eventos; la agenda pública lo filtra client-side. Reversible.
//
// La lista se arma en el cliente (JSON estáticos + /api/eventos) para no
// duplicar la lógica de merge/dedup que ya existe.

const ESTATICOS = [...eventosCurados, ...eventosExternos]
const MAX_FILAS = 60
const DIAS_DESTACADO = 30 // duración por defecto al destacar con un clic

const ETIQUETA_ORIGEN = { municipal: 'Ayuntamiento', vecinal: 'Vecinal', cultural: 'Cultural' }

function fuenteDe(evento) {
  return evento.fuente || ETIQUETA_ORIGEN[evento.origen] || 'Evento'
}

// Miniatura del evento para la fila del listado: cartel real si lo hay
// (lazy, y si la URL falla el hook la anula) o el mismo fallback que las
// tarjetas públicas — degradado de categoría + trama + icono Tabler.
// Componente propio porque useImagenEvento es un hook y no puede llamarse
// dentro del map de filas.
function MiniaturaEvento({ evento, clase = 'h-12 w-12', tamIcono = 20 }) {
  const { posterUrl, pos, onError } = useImagenEvento(evento)
  const { fondo, trama } = cartelDe(evento.categoria)
  return posterUrl ? (
    <img
      src={posterUrl}
      alt=""
      loading="lazy"
      onError={onError}
      className={`${clase} shrink-0 border border-filete object-cover`}
      style={{ objectPosition: pos }}
    />
  ) : (
    <div
      aria-hidden="true"
      className={`relative flex ${clase} shrink-0 items-center justify-center border border-filete ${trama}`}
      style={{ background: fondo }}
    >
      <IconoCategoriaTabler
        categoria={evento.categoria}
        subcategoria={evento.subcategoria}
        size={tamIcono}
        stroke={1.5}
        className="text-papel/80"
      />
    </div>
  )
}

// Detalle desplegado bajo la fila (acordeón): imagen grande + los campos del
// evento que la fila comprime. Solo lectura — las acciones siguen en la fila.
function DetalleEvento({ evento, fuenteIngesta }) {
  const datos = [
    ['Fecha', evento.fecha ? formatearFechaLarga(evento.fecha) : 'Sin fecha'],
    ['Hora', evento.hora || null],
    ['Lugar', evento.lugar || null],
    ['Organiza', fuenteDe(evento)],
    [
      'Categoría',
      `${CATEGORIAS_EVENTO[evento.categoria]?.nombre || evento.categoria || '—'}${
        evento.subcategoria ? ` · ${evento.subcategoria}` : ''
      }`,
    ],
    ['Vía de ingesta', fuenteIngesta],
    ['Id', evento.id],
    [
      'Ids secundarios',
      evento.idsSecundarios?.length ? evento.idsSecundarios.join(', ') : null,
    ],
  ].filter(([, valor]) => valor)

  return (
    <div className="mt-3 flex flex-col gap-4 border border-filete bg-papel-calido p-4 sm:flex-row">
      <MiniaturaEvento evento={evento} clase="h-52 w-40" tamIcono={44} />
      <div className="min-w-0 flex-1 space-y-3">
        {evento.descripcion && (
          <p className="whitespace-pre-line font-serif-spectral text-sm leading-relaxed text-tinta">
            {evento.descripcion}
          </p>
        )}
        <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {datos.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="min-w-0">
              <dt className="font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-mudo">
                {etiqueta}
              </dt>
              <dd className="break-words font-serif-spectral text-sm text-tinta">{valor}</dd>
            </div>
          ))}
        </dl>
        <a
          href={`/eventos/${encodeURIComponent(evento.id)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota hover:underline"
        >
          <MIcon name="open_in_new" className="text-[13px]" />
          Ver ficha pública
        </a>
      </div>
    </div>
  )
}

export default function TablesEventos() {
  const [deLaBase, setDeLaBase] = useState([])
  const [destacados, setDestacados] = useState([]) // solo tipo evento
  const [ocultos, setOcultos] = useState(() => new Set())
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [incluirPasados, setIncluirPasados] = useState(false)
  const [ocupadoId, setOcupadoId] = useState(null) // id del evento con acción en curso
  const [abiertoId, setAbiertoId] = useState(null) // id del evento con el detalle desplegado
  const [mensaje, setMensaje] = useState(null) // { tipo: 'error', texto }

  useEffect(() => {
    let vigente = true
    Promise.all([
      fetch('/api/eventos').then((r) => (r.ok ? r.json() : { eventos: [] })).catch(() => ({ eventos: [] })),
      fetch('/api/super/destacados').then((r) => (r.ok ? r.json() : { destacados: [] })).catch(() => ({ destacados: [] })),
      fetch('/api/super/eventos').then((r) => (r.ok ? r.json() : { ocultos: [] })).catch(() => ({ ocultos: [] })),
    ])
      .then(([ev, de, oc]) => {
        if (!vigente) return
        setDeLaBase(ev.eventos ?? [])
        setDestacados((de.destacados ?? []).filter((d) => d.tipo === 'evento'))
        setOcultos(new Set(oc.ocultos ?? []))
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [])

  const eventos = useMemo(() => combinarEventos(ESTATICOS, deLaBase), [deLaBase])

  const destacadoPorRef = useMemo(() => {
    const mapa = new Map()
    for (const d of destacados) mapa.set(d.referenciaId, d)
    return mapa
  }, [destacados])

  // Un destacado apunta al id principal del evento o a cualquiera de los
  // idsSecundarios que la fusión de duplicados haya acumulado.
  function destacadoDe(evento) {
    return (
      destacadoPorRef.get(evento.id) ||
      (evento.idsSecundarios || []).map((id) => destacadoPorRef.get(id)).find(Boolean) ||
      null
    )
  }
  function estaOculto(evento) {
    return ocultos.has(evento.id) || (evento.idsSecundarios || []).some((id) => ocultos.has(id))
  }

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return eventos
      .filter((e) => incluirPasados || diasHasta(e.fecha) >= 0)
      .filter(
        (e) =>
          !texto ||
          e.titulo.toLowerCase().includes(texto) ||
          (e.lugar || '').toLowerCase().includes(texto),
      )
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
  }, [eventos, busqueda, incluirPasados])

  const visibles = filtrados.slice(0, MAX_FILAS)

  async function destacar(evento) {
    setOcupadoId(evento.id)
    setMensaje(null)
    try {
      const inicio = hoyISO()
      const respuesta = await fetch('/api/super/destacados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'evento',
          referenciaId: evento.id,
          orden: 0,
          fechaInicio: inicio,
          fechaFin: sumarDias(inicio, DIAS_DESTACADO - 1),
          estado: 'activo',
        }),
      })
      const datos = await respuesta.json().catch(() => ({}))
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo destacar el evento.')
      setDestacados((previos) => [...previos.filter((d) => d.id !== datos.destacado.id), datos.destacado])
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  async function quitarDestacado(evento) {
    const destacado = destacadoDe(evento)
    if (!destacado) return
    setOcupadoId(evento.id)
    setMensaje(null)
    try {
      const respuesta = await fetch(`/api/super/destacados?id=${destacado.id}`, { method: 'DELETE' })
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(datos.error || 'No se pudo quitar el destacado.')
      }
      setDestacados((previos) => previos.filter((d) => d.id !== destacado.id))
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  async function ocultar(evento) {
    setOcupadoId(evento.id)
    setMensaje(null)
    try {
      const respuesta = await fetch('/api/super/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenciaId: evento.id }),
      })
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(datos.error || 'No se pudo ocultar el evento.')
      }
      setOcultos((previos) => new Set(previos).add(evento.id))
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  async function mostrar(evento) {
    // Puede haber varias refs ocultas del mismo evento (principal + secundarias).
    const refs = [evento.id, ...(evento.idsSecundarios || [])].filter((id) => ocultos.has(id))
    if (!refs.length) return
    setOcupadoId(evento.id)
    setMensaje(null)
    try {
      for (const ref of refs) {
        const respuesta = await fetch(`/api/super/eventos?ref=${encodeURIComponent(ref)}`, {
          method: 'DELETE',
        })
        if (!respuesta.ok) {
          const datos = await respuesta.json().catch(() => ({}))
          throw new Error(datos.error || 'No se pudo mostrar el evento.')
        }
      }
      setOcultos((previos) => {
        const copia = new Set(previos)
        refs.forEach((ref) => copia.delete(ref))
        return copia
      })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif-dm text-xl text-tinta">Eventos publicados</h2>
        <p className="mt-1 font-serif-spectral text-sm text-pardo">
          Todos los eventos de la agenda (curados, sincronizados y de las organizaciones).
          Destaca cualquiera con un clic (dura {DIAS_DESTACADO} días; afina su orden y vigencia
          en el tab Destacados) u ocúltalo de la agenda pública. Ocultar es reversible y no
          borra el evento.
        </p>
      </div>

      {mensaje && (
        <p className="flex items-start gap-2 border border-terracota bg-terracota-fondo px-4 py-3 font-serif-spectral text-sm text-terracota">
          <MIcon name="error" className="mt-0.5 text-[18px]" />
          <span>{mensaje.texto}</span>
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MIcon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-mudo"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Busca por título o lugar…"
            className="gz-input w-full pl-9"
          />
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta text-tinta">
          <input
            type="checkbox"
            checked={incluirPasados}
            onChange={(e) => setIncluirPasados(e.target.checked)}
            className="accent-terracota"
          />
          Incluir pasados
        </label>
      </div>

      <p className="gz-label text-mudo">
        {cargando
          ? 'Cargando eventos…'
          : `${filtrados.length} ${filtrados.length === 1 ? 'evento' : 'eventos'}`}
        {!cargando && filtrados.length > MAX_FILAS && ` (se muestran ${MAX_FILAS} — afina la búsqueda)`}
      </p>

      <div className="divide-y divide-filete border-t border-tinta">
        {visibles.map((evento) => {
          const destacado = destacadoDe(evento)
          const oculto = estaOculto(evento)
          const ocupado = ocupadoId === evento.id
          const pasado = diasHasta(evento.fecha) < 0
          const fuenteIngesta = fuenteDeIngesta(evento)
          const abierto = abiertoId === evento.id
          return (
            <div key={evento.id} className={`py-3 ${oculto ? 'opacity-60' : ''}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <button
                type="button"
                onClick={() => setAbiertoId((previo) => (previo === evento.id ? null : evento.id))}
                aria-expanded={abierto}
                title={abierto ? 'Replegar el detalle' : 'Ver el detalle del evento'}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <MiniaturaEvento evento={evento} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif-dm text-base leading-tight text-tinta">
                    {evento.titulo}
                    {destacado && (
                      <MIcon name="star" className="ml-2 align-middle text-[15px] text-ocre-profundo" />
                    )}
                  </p>
                  <p className="mt-0.5 truncate font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                    {formatearFechaCorta(evento.fecha)}
                    {evento.hora ? `, ${evento.hora}` : ''} · {fuenteDe(evento)}
                    {CATEGORIAS_EVENTO[evento.categoria]?.nombre
                      ? ` · ${CATEGORIAS_EVENTO[evento.categoria].nombre}`
                      : ''}
                    {fuenteIngesta && (
                      <span
                        className="ml-2 text-mudo"
                        title="Vía por la que este evento entró en la agenda (solo visible en este panel)"
                      >
                        · {fuenteIngesta}
                      </span>
                    )}
                    {pasado && <span className="ml-2 text-mudo">· pasado</span>}
                    {evento.fusionadoPorTituloAproximado && (
                      <span
                        className="ml-2 text-ocre-profundo"
                        title="Fusionado con un evento del Ayuntamiento por título aproximado (los títulos no eran equivalentes). Revisa que sea el mismo acto; si no lo es, ocúltalo."
                      >
                        · fusión aproximada
                      </span>
                    )}
                  </p>
                </div>
                <MIcon
                  name={abierto ? 'expand_less' : 'expand_more'}
                  className="shrink-0 text-[18px] text-mudo"
                />
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {destacado ? (
                  <button
                    type="button"
                    onClick={() => quitarDestacado(evento)}
                    disabled={ocupado}
                    className="inline-flex items-center gap-1 border border-ocre-profundo bg-papel-calido px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-ocre-profundo transition-colors hover:bg-ocre-profundo hover:text-papel disabled:opacity-40"
                    title="Quitar de destacados"
                  >
                    <MIcon name="star" className="text-[14px]" />
                    Destacado
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => destacar(evento)}
                    disabled={ocupado || pasado}
                    className="inline-flex items-center gap-1 border border-filete px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo transition-colors hover:border-ocre-profundo hover:text-ocre-profundo disabled:cursor-not-allowed disabled:opacity-40"
                    title={pasado ? 'No tiene sentido destacar un evento pasado' : 'Destacar este evento'}
                  >
                    <MIcon name="star_outline" className="text-[14px]" />
                    Destacar
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => (oculto ? mostrar(evento) : ocultar(evento))}
                  disabled={ocupado}
                  className={`inline-flex items-center gap-1 border px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta transition-colors disabled:opacity-40 ${
                    oculto
                      ? 'border-terracota bg-terracota text-papel'
                      : 'border-filete text-pardo hover:border-terracota hover:text-terracota'
                  }`}
                  title={oculto ? 'Volver a mostrar en la agenda' : 'Ocultar de la agenda pública'}
                >
                  <MIcon name={oculto ? 'visibility' : 'visibility_off'} className="text-[14px]" />
                  {oculto ? 'Oculto' : 'Ocultar'}
                </button>
              </div>
              </div>

              {abierto && <DetalleEvento evento={evento} fuenteIngesta={fuenteIngesta} />}
            </div>
          )
        })}

        {!cargando && visibles.length === 0 && (
          <p className="border border-dashed border-filete-punteado p-8 text-center font-serif-spectral text-sm text-pardo">
            No hay eventos que coincidan con el filtro.
          </p>
        )}
      </div>
    </div>
  )
}
