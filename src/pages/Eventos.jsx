import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useEventosPublicos } from '../lib/useEventosPublicos.js'
import {
  CATEGORIAS_EVENTO,
  LISTA_CATEGORIAS_EVENTO,
  proximosEventos,
  eventosPasados,
  formatearFechaCorta,
} from '../lib/eventos.js'
import { IconoEvento } from '../components/eventos/iconosEvento.jsx'
import EventoFila from '../components/eventos/EventoFila.jsx'
import { imagenEvento, CREDITOS_FOTOS } from '../lib/imagenesEvento.js'
import MIcon from '../components/MIcon.jsx'
import { useDestacados } from '../lib/useDestacados.js'
import CarruselDestacados from '../components/destacados/CarruselDestacados.jsx'
import DialogoAvisos from '../components/eventos/DialogoAvisos.jsx'
import DialogoBandeja from '../components/eventos/DialogoBandeja.jsx'
import { prefsLocales } from '../lib/push.js'
import { useAvisos } from '../lib/useAvisos.js'

export default function Eventos() {
  const [categoria, setCategoria] = useState(null)
  const [avisosAbierto, setAvisosAbierto] = useState(false)
  const [bandejaAbierta, setBandejaAbierta] = useState(false)
  // Solo para pintar el botón ("Recibir avisos" vs "Avisos activados"): la
  // copia local de las preferencias, no el estado real del servidor.
  const [avisosActivos, setAvisosActivos] = useState(() => Boolean(prefsLocales()))

  // Bandeja de avisos recibidos (historial filtrado por los temas del aparato).
  const { avisos, noLeidos, refrescarVisto } = useAvisos()

  // Estáticos del JSON + los que las organizaciones han publicado desde /admin.
  const { eventos: todos } = useEventosPublicos()

  // Solo se ofrecen como filtro las categorías presentes (en próximos o pasados).
  const categoriasDisponibles = useMemo(() => {
    const presentes = new Set(todos.map((e) => e.categoria))
    return LISTA_CATEGORIAS_EVENTO.filter((c) => presentes.has(c.id))
  }, [todos])

  const porCategoria = (lista) =>
    categoria ? lista.filter((e) => e.categoria === categoria) : lista

  const futuros = useMemo(() => porCategoria(proximosEventos(todos)), [todos, categoria])
  const pasados = useMemo(() => porCategoria(eventosPasados(todos)), [todos, categoria])

  // Eventos destacados contratados. El carrusel solo sustituye al hero en la
  // vista sin filtrar; con un filtro activo (o sin destacados vigentes) se
  // conserva el comportamiento clásico: el primer próximo como hero grande.
  const { items: destacadosEvento } = useDestacados({ eventos: todos, tipo: 'evento' })
  const conCarrusel = categoria === null && destacadosEvento.length > 0

  // El carrusel realza, no quita: con él, la lista inferior muestra todos los
  // próximos; sin él, el primero pasa a ser el hero y el resto la lista.
  const [destacado, ...resto] = conCarrusel ? [null, ...futuros] : futuros

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
            Agenda cultural
          </h1>
          <p className="mt-1 text-on-surface-variant">Descubre lo que sucede en tu comunidad.</p>
        </div>
        {/* Campana (bandeja de avisos) + opt-in de push: solo en Eventos. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBandejaAbierta(true)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant transition-colors hover:bg-surface-container-high"
            aria-label={noLeidos > 0 ? `Tus avisos (${noLeidos} sin leer)` : 'Tus avisos'}
          >
            <MIcon name="notifications" className="text-[20px]" />
            {noLeidos > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-on-primary">
                {noLeidos > 9 ? '9+' : noLeidos}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setAvisosAbierto(true)}
            className={`nv-chip flex items-center gap-2 whitespace-nowrap transition-all ${
              avisosActivos
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-primary text-on-primary shadow-md hover:opacity-90'
            }`}
          >
            <MIcon
              name={avisosActivos ? 'notifications_active' : 'notifications'}
              className="text-[18px]"
              fill={avisosActivos}
            />
            {avisosActivos ? 'Avisos activados' : 'Recibir avisos'}
          </button>
        </div>
      </header>

      <DialogoAvisos
        abierto={avisosAbierto}
        onCerrar={() => {
          setAvisosAbierto(false)
          setAvisosActivos(Boolean(prefsLocales()))
        }}
      />

      <DialogoBandeja
        abierto={bandejaAbierta}
        avisos={avisos}
        onLeidos={refrescarVisto}
        onCerrar={() => setBandejaAbierta(false)}
      />

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

      {/* Destacados (contratados): sección propia, encima de los próximos. */}
      {conCarrusel && (
        <section className="space-y-6">
          <h2 className="nv-section-title flex items-center gap-2 md:text-2xl">
            <MIcon name="kid_star" className="text-[22px]" fill />
            Destacados
          </h2>
          <CarruselDestacados items={destacadosEvento} tamano="grande" columnas={3} seccion="eventos" />
        </section>
      )}

      {/* ----------------------------- Próximos ----------------------------- */}
      <section className="space-y-6">
        <h2 className="nv-section-title flex items-center gap-2 md:text-2xl">
          <MIcon name="event_upcoming" className="text-[22px]" />
          Próximos eventos
        </h2>

        {futuros.length === 0 && (
          <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center text-on-surface-variant">
            No hay eventos próximos por ahora. Consulta más abajo el histórico de actividades.
          </p>
        )}

        {/* Evento destacado (fallback clásico: el primer próximo) */}
        {destacado && (
          <Link
            to={`/eventos/${destacado.id}`}
            className="relative block h-64 w-full overflow-hidden rounded-xl shadow-card transition-shadow hover:shadow-card-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary md:h-80"
          >
            {imagenEvento(destacado) ? (
              <img
                src={imagenEvento(destacado).src}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: imagenEvento(destacado).pos || '50% 50%' }}
              />
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-primary-container via-primary to-[#083824]" />
                <div className="absolute inset-0 flex items-center justify-center opacity-15">
                  <IconoEvento categoria={destacado.categoria} className="text-[180px] text-white" />
                </div>
              </>
            )}
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
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
          </Link>
        )}

        {/* Resto de próximos */}
        {resto.length > 0 && (
          <div className="flex flex-col gap-4">
            {resto.map((e) => (
              <EventoFila key={e.id} evento={e} />
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------- Anteriores ---------------------------- */}
      {pasados.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-4 pt-2">
            <div className="h-px flex-1 bg-outline-variant/60" />
            <h2 className="nv-section-title flex items-center gap-2 text-on-surface-variant md:text-2xl">
              <MIcon name="history" className="text-[22px]" />
              Eventos anteriores
            </h2>
            <div className="h-px flex-1 bg-outline-variant/60" />
          </div>
          <p className="-mt-2 text-center text-sm text-on-surface-variant">
            Histórico de actividades culturales que ya se han celebrado.
          </p>

          <div className="flex flex-col gap-4">
            {pasados.map((e) => (
              <EventoFila key={e.id} evento={e} pasado />
            ))}
          </div>
        </section>
      )}

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

      <p className="text-center text-[10px] leading-relaxed text-on-surface-variant/70">
        Imágenes ilustrativas vía Wikimedia Commons: {CREDITOS_FOTOS.join(' · ')}
      </p>
    </div>
  )
}
