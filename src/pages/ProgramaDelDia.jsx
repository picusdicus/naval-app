import { useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import MIcon from '../components/MIcon'
import { useEventosPublicos } from '../lib/useEventosPublicos'
import {
  CATEGORIAS_EVENTO,
  agruparPorTramoHorario,
  eventosDelDia,
  diaSemanaDe,
  mesDe,
} from '../lib/eventos'
import { sumarDias } from '../lib/fechas'
import { cartelDe } from '../lib/gaceta'
import { useImagenEvento } from '../lib/useImagenEvento'

const TRAMOS = ['mañana', 'tarde', 'noche', 'madrugada']
const ETIQUETA_TRAMO = {
  mañana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
  madrugada: 'Madrugada',
}

// Cartel 3:4 reutilizable dentro del programa: cartel real o foto temática por
// categoría; el degradado solo como último recurso.
function CartelMini({ evento, className = '' }) {
  // posterUrl pasa a null si la url del cartel falla al cargar (onError), y
  // entonces se pinta el degradado de categoría en vez del alt roto.
  const { posterUrl, pos, onError } = useImagenEvento(evento)
  const { fondo, trama } = cartelDe(evento.categoria)
  return posterUrl ? (
    <img
      src={posterUrl}
      alt={evento.titulo}
      loading="lazy"
      onError={onError}
      style={{ objectPosition: pos }}
      className={`aspect-[3/4] w-full object-cover ${className}`}
    />
  ) : (
    <div
      className={`aspect-[3/4] w-full ${trama} ${className}`}
      style={{ background: fondo }}
      aria-hidden="true"
    />
  )
}

/**
 * Programa del día: la agenda completa de una fecha, en franja horaria.
 * Agrupada por tramos (Mañana / Tarde / Noche / Madrugada). La madrugada se
 * compacta en una lista de filas para no inflar la página.
 */
export default function ProgramaDelDia() {
  // El segmento es una fecha 'YYYY-MM-DD' (el dispatcher de App.jsx solo
  // encamina aquí las fechas; los ids de evento van a EventoDetalle).
  const { id: diaParam } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const { eventos: todosLosEventos } = useEventosPublicos()

  // Los filtros de tipo activos se conservan al entrar y al volver (query param).
  const categoriasActivas = useMemo(() => {
    const cats = new URLSearchParams(location.search).get('categorias')
    return cats ? cats.split(',') : []
  }, [location.search])

  const eventos = useMemo(
    () => eventosDelDia(todosLosEventos, diaParam, categoriasActivas),
    [todosLosEventos, diaParam, categoriasActivas]
  )

  const eventosPorTramo = useMemo(() => agruparPorTramoHorario(eventos), [eventos])

  const diaNombre = diaSemanaDe(diaParam)
  const mesNombre = mesDe(diaParam)
  const numeroDia = parseInt(diaParam.split('-')[2], 10)

  // Resumen en mono: N actos · rango horario · nº de lugares distintos.
  const conHora = eventos.filter((e) => e.hora)
  const primeraHora = conHora[0]?.hora
  const ultimaHora = conHora[conHora.length - 1]?.hora
  const numLugares = new Set(eventos.map((e) => e.lugar)).size

  const irAlDia = (nuevoDia) => {
    const params = new URLSearchParams()
    if (categoriasActivas.length > 0) params.append('categorias', categoriasActivas.join(','))
    const qs = params.toString()
    navigate(`/eventos/${nuevoDia}${qs ? `?${qs}` : ''}`)
  }

  const volverALaCartelera = () => {
    const params = new URLSearchParams()
    params.append('dia', diaParam)
    if (categoriasActivas.length > 0) params.append('categorias', categoriasActivas.join(','))
    navigate(`/eventos?${params.toString()}`)
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Cabecera */}
      <button
        type="button"
        onClick={volverALaCartelera}
        className="mb-6 inline-flex items-center gap-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta transition hover:text-terracota"
      >
        <MIcon name="arrow_back" className="text-[15px]" />
        Volver a la cartelera
      </button>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="font-serif-dm text-6xl leading-none text-tinta">{numeroDia}</span>
            <h1 className="font-serif-dm text-3xl italic text-tinta">
              {diaNombre} de {mesNombre.toLowerCase()}
            </h1>
          </div>
          <p className="mt-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-mudo">
            {eventos.length} acto{eventos.length !== 1 ? 's' : ''}
            {primeraHora && ` · de ${primeraHora} a ${ultimaHora}`}
            {numLugares > 0 && ` · ${numLugares} lugar${numLugares !== 1 ? 'es' : ''}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => irAlDia(sumarDias(diaParam, -1))}
            className="inline-flex items-center gap-1.5 border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition hover:bg-tinta hover:text-papel"
          >
            <MIcon name="arrow_back" className="text-[14px]" />
            Día anterior
          </button>
          <button
            type="button"
            onClick={() => irAlDia(sumarDias(diaParam, 1))}
            className="inline-flex items-center gap-1.5 border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition hover:bg-tinta hover:text-papel"
          >
            Día siguiente
            <MIcon name="arrow_forward" className="text-[14px]" />
          </button>
        </div>
      </div>

      <div className="mb-8 h-px bg-tinta" />

      {eventos.length === 0 && (
        <p className="border border-dashed border-filete-punteado p-8 text-center font-serif-spectral text-pardo">
          No hay actos programados para {diaNombre.toLowerCase()} de {mesNombre.toLowerCase()}.
        </p>
      )}

      {/* Programa por tramos */}
      <div className="space-y-10">
        {TRAMOS.map((tramo) => {
          const lista = eventosPorTramo[tramo]
          if (!lista.length) return null
          const esMadrugada = tramo === 'madrugada'

          return (
            <section key={tramo} className="animate-fade">
              <div className="mb-4 flex items-center gap-4">
                <h2 className="font-mono-ibm text-[11px] uppercase tracking-etiqueta text-mudo">
                  {ETIQUETA_TRAMO[tramo]}
                </h2>
                <div className="h-px flex-1 bg-filete" />
              </div>

              {esMadrugada ? (
                // Madrugada: lista compacta sobre papel cálido.
                <div className="divide-y divide-filete border border-filete bg-papel-calido">
                  {lista.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => navigate(`/eventos/${e.id}`)}
                      className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-papel"
                    >
                      <span className="w-14 flex-shrink-0 font-serif-dm text-lg text-tinta">
                        {e.hora || '—'}
                      </span>
                      <span className="flex-1 truncate font-serif-spectral text-tinta">
                        {e.titulo}
                      </span>
                      <span className="hidden font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo sm:block">
                        {e.lugar}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {lista.map((evento) => {
                    const cat = CATEGORIAS_EVENTO[evento.categoria]
                    return (
                      <div
                        key={evento.id}
                        className="grid grid-cols-[64px_1fr] gap-3 md:grid-cols-[96px_1fr] md:gap-5"
                      >
                        {/* Columna de hora */}
                        <div className="pt-1 text-right md:text-left">
                          <div className="font-serif-dm text-xl text-tinta md:text-2xl">
                            {evento.hora || '—'}
                          </div>
                          {evento.horaFin && (
                            <div className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
                              hasta {evento.horaFin}
                            </div>
                          )}
                        </div>

                        {/* Tarjeta del acto */}
                        <article className="flex gap-4 overflow-hidden rounded-[18px] border border-[#e4dbc6] bg-white">
                          <button
                            type="button"
                            onClick={() => navigate(`/eventos/${evento.id}`)}
                            className="w-20 flex-shrink-0 md:w-28"
                            aria-label={`Ver ${evento.titulo}`}
                          >
                            <CartelMini evento={evento} className="h-full" />
                          </button>

                          <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-4 pr-4">
                            <span className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota">
                              {cat?.nombre}
                            </span>
                            <h3 className="font-serif-dm text-xl italic leading-tight text-tinta md:text-2xl">
                              {evento.titulo}
                            </h3>
                            {evento.descripcion && (
                              <p className="line-clamp-2 font-serif-spectral text-sm text-pardo">
                                {evento.descripcion}
                              </p>
                            )}
                            <div className="mt-1 flex items-center gap-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
                              <MIcon name="location_on" className="text-[13px]" />
                              <span className="truncate">{evento.lugar}</span>
                              {evento.entradas?.precio && <span>· {evento.entradas.precio}</span>}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/eventos/${evento.id}`)}
                                className="inline-flex items-center gap-1 bg-tinta px-3 py-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-papel transition hover:opacity-90"
                              >
                                Ver ficha
                              </button>
                              {evento.entradas?.url && (
                                <a
                                  href={evento.entradas.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 border border-tinta px-3 py-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition hover:bg-tinta hover:text-papel"
                                >
                                  Reservar
                                </a>
                              )}
                            </div>
                          </div>
                        </article>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
