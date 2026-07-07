import { useMemo, useState } from 'react'
import eventosCurados from '../data/eventos.json'
import eventosExternos from '../data/eventos-externos.json'
import {
  CATEGORIAS_EVENTO,
  LISTA_CATEGORIAS_EVENTO,
  proximosEventos,
  formatearFechaCorta,
} from '../lib/eventos.js'
import { IconoEvento } from '../components/eventos/iconosEvento.jsx'
import MIcon from '../components/MIcon.jsx'

function horaTexto(e) {
  if (!e.hora) return ''
  return e.horaFin ? `${e.hora} – ${e.horaFin}` : e.hora
}

const ORIGEN = {
  municipal: 'Municipal',
  cultural: 'Cultura',
  vecinal: 'Vecinal',
}

export default function Eventos() {
  const [categoria, setCategoria] = useState(null)

  const todos = useMemo(() => proximosEventos([...eventosCurados, ...eventosExternos]), [])

  // Solo se ofrecen como filtro las categorías que tienen eventos próximos.
  const categoriasDisponibles = useMemo(() => {
    const presentes = new Set(todos.map((e) => e.categoria))
    return LISTA_CATEGORIAS_EVENTO.filter((c) => presentes.has(c.id))
  }, [todos])

  const eventos = useMemo(
    () => (categoria ? todos.filter((e) => e.categoria === categoria) : todos),
    [todos, categoria],
  )

  const [destacado, ...resto] = eventos

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
          Agenda cultural
        </h1>
        <p className="mt-1 text-on-surface-variant">
          Descubre lo que sucede en tu comunidad.
        </p>
      </header>

      {/* Selector de categorías */}
      {categoriasDisponibles.length > 0 && (
        <div className="hide-scrollbar -mt-2 flex gap-3 overflow-x-auto py-2">
          <button
            type="button"
            onClick={() => setCategoria(null)}
            className={`nv-chip whitespace-nowrap transition-all ${
              categoria === null
                ? 'bg-primary text-on-primary shadow-md'
                : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Todos
          </button>
          {categoriasDisponibles.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoria(cat.id)}
              className={`nv-chip whitespace-nowrap transition-all ${
                categoria === cat.id
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
      )}

      {eventos.length === 0 && (
        <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center text-on-surface-variant">
          No hay eventos próximos por ahora. ¡Vuelve pronto!
        </p>
      )}

      {/* Evento destacado */}
      {destacado && (
        <section className="relative h-64 w-full overflow-hidden rounded-xl shadow-card md:h-80">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-container via-primary to-[#083824]" />
          <div className="absolute inset-0 flex items-center justify-center opacity-15">
            <IconoEvento categoria={destacado.categoria} className="text-[180px] text-white" />
          </div>
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 z-20 w-full p-6">
            <span className="mb-2 inline-block rounded-full bg-secondary-container px-3 py-1 text-xs font-medium text-on-secondary-container">
              {CATEGORIAS_EVENTO[destacado.categoria]?.nombre || 'Evento'}
            </span>
            <h3 className="mb-2 font-display text-xl font-semibold text-white md:text-2xl">
              {destacado.titulo}
            </h3>
            <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-white/90">
              <div className="flex items-center gap-1">
                <MIcon name="calendar_today" className="text-[18px]" />
                <span>
                  {formatearFechaCorta(destacado.fecha)}
                  {destacado.hora ? `, ${destacado.hora}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <MIcon name="location_on" className="text-[18px]" />
                <span>{destacado.lugar}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Lista de eventos */}
      <section className="flex flex-col gap-4">
        {resto.map((e) => (
          <article key={e.id} className="nv-card flex gap-4 p-4 transition-shadow hover:shadow-card-lg">
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary-container to-primary text-on-primary-container sm:h-32 sm:w-32">
              <IconoEvento categoria={e.categoria} className="text-[36px]" />
            </div>
            <div className="flex flex-grow flex-col justify-between">
              <div>
                <div className="mb-1 flex items-start justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-secondary">
                    {CATEGORIAS_EVENTO[e.categoria]?.nombre || 'Evento'} ·{' '}
                    {ORIGEN[e.origen] || 'Vecinal'}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {formatearFechaCorta(e.fecha)}
                  </span>
                </div>
                <h4 className="mb-2 font-display text-base font-semibold text-on-surface">
                  {e.titulo}
                </h4>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surface-variant">
                  {horaTexto(e) && (
                    <div className="flex items-center gap-1">
                      <MIcon name="schedule" className="text-[16px]" />
                      <span>{horaTexto(e)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <MIcon name="location_on" className="text-[16px]" />
                    <span>{e.lugar}</span>
                  </div>
                </div>
                {e.descripcion && (
                  <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
                    {e.descripcion}
                  </p>
                )}
              </div>
              {e.url && (
                <div className="mt-2 flex justify-end">
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    Detalles <MIcon name="chevron_right" className="text-[18px]" />
                  </a>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center rounded-xl bg-primary-container p-6 text-center text-on-primary-container md:p-10">
        <MIcon name="campaign" className="mb-2 text-[48px] opacity-80" />
        <h3 className="mb-2 font-display text-lg font-semibold">¿Organizas un evento?</h3>
        <p className="mb-6 max-w-md text-sm opacity-90">
          Si tu asociación o negocio organiza una actividad en Navalcarnero, cuéntanoslo y la
          publicaremos en la agenda vecinal.
        </p>
        <a
          href="mailto:directorio@navalcarnero.example?subject=Propuesta%20de%20evento"
          className="rounded-full bg-secondary-container px-8 py-3 text-sm font-semibold text-on-secondary-container transition-opacity hover:opacity-90"
        >
          Proponer un evento
        </a>
      </section>
    </div>
  )
}
