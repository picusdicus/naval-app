import { Link, useOutletContext } from 'react-router-dom'
import eventosCurados from '../data/eventos.json'
import eventosExternos from '../data/eventos-externos.json'
import { proximosEventos, formatearFechaCorta } from '../lib/eventos.js'
import { CATEGORIAS_EVENTO } from '../lib/eventos.js'
import { IconoEvento } from '../components/eventos/iconosEvento.jsx'
import { imagenEvento } from '../lib/imagenesEvento.js'
import MIcon from '../components/MIcon.jsx'

const proximos = proximosEventos([...eventosCurados, ...eventosExternos], 4)

function saludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días, vecino'
  if (h < 20) return 'Buenas tardes, vecino'
  return 'Buenas noches, vecino'
}

function fechaHoy() {
  const texto = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default function Inicio() {
  const { abrirChat } = useOutletContext()

  return (
    <div className="space-y-8 md:space-y-16">
      {/* Bienvenida (móvil) */}
      <section className="nv-card p-6 md:hidden">
        <h2 className="mb-2 font-display text-xl font-semibold text-primary">{saludo()}</h2>
        <p className="text-on-surface-variant">
          {fechaHoy()}. Esto es lo que pasa hoy en Navalcarnero.
        </p>
      </section>

      {/* Hero: Plaza de Segovia (foto: D.G. Turismo de la Comunidad de Madrid,
          CC BY 3.0 ES, vía Wikimedia Commons) */}
      <section className="relative h-56 overflow-hidden rounded-xl shadow-card md:h-[420px]">
        <img
          src="/img/plaza-segovia.jpg"
          alt="Plaza de Segovia de Navalcarnero, con el Ayuntamiento y la iglesia"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/5" />
        <a
          href="https://commons.wikimedia.org/wiki/File:Plaza_de_Segovia_con_Ayuntamiento_e_iglesia_en_Navalcarnero.jpg"
          target="_blank"
          rel="noreferrer"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/30 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm hover:text-white"
        >
          Foto: D.G. Turismo CM · CC BY 3.0 ES
        </a>
        <div className="relative flex h-full flex-col justify-end p-6 text-white md:p-12">
          <h1 className="max-w-2xl font-display text-2xl font-bold leading-tight md:text-5xl">
            Bienvenido a tu plaza digital
          </h1>
          <p className="mt-3 hidden max-w-xl text-lg opacity-90 md:block">
            Conectando Navalcarnero a través de la información local, los eventos y los servicios
            vecinales.
          </p>
          <div className="mt-6 hidden gap-4 md:flex">
            <Link
              to="/eventos"
              className="rounded-lg bg-secondary-container px-8 py-3 text-sm font-semibold text-on-secondary-container transition-all hover:opacity-90"
            >
              Ver eventos
            </Link>
            <Link
              to="/mapa"
              className="rounded-lg bg-white/70 px-8 py-3 text-sm font-semibold text-on-surface backdrop-blur transition-all hover:bg-white"
            >
              Guía local
            </Link>
          </div>
        </div>
      </section>

      {/* Accesos rápidos (móvil) */}
      <section className="grid grid-cols-2 gap-4 md:hidden">
        <Link
          to="/asistente"
          className="nv-card flex flex-col items-center justify-center p-4 text-center"
        >
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <MIcon name="smart_toy" />
          </div>
          <span className="text-sm font-semibold text-on-surface">Preguntar al asistente</span>
        </Link>
        <Link
          to="/noticias"
          className="nv-card flex flex-col items-center justify-center p-4 text-center"
        >
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <MIcon name="report" />
          </div>
          <span className="text-sm font-semibold text-on-surface">Avisos y noticias</span>
        </Link>
      </section>

      {/* Estado del municipio + tiempo */}
      <section className="grid grid-cols-12 gap-4 md:gap-8">
        <div className="col-span-12 space-y-4 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="nv-section-title md:text-2xl">Estado del municipio</h2>
            <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold text-on-secondary-container">
              Todo operativo
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border-l-4 border-error bg-surface-container-lowest p-6 shadow-card transition-shadow hover:shadow-card-lg">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-error-container p-3">
                  <MIcon name="water_drop" className="text-error" fill />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-on-surface">
                    Corte de agua programado
                  </h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Mantenimiento en el barrio de la Estación. Martes de 8:00 a 14:00.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border-l-4 border-secondary bg-surface-container-lowest p-6 shadow-card transition-shadow hover:shadow-card-lg">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-secondary-container p-3">
                  <MIcon name="handyman" className="text-secondary" fill />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-on-surface">
                    Obras finalizadas
                  </h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Pavimentación de la Av. del Parque completada. Abierta al tráfico.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Widget de tiempo */}
        <div className="relative col-span-12 flex flex-col justify-between overflow-hidden rounded-xl bg-primary-container p-8 text-on-primary-container lg:col-span-4">
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold opacity-70">Navalcarnero</div>
                <div className="font-display text-4xl font-bold text-white">31°C</div>
              </div>
              <MIcon name="clear_day" className="text-4xl" fill />
            </div>
            <div className="mt-8 space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-white/20 pb-2">
                <span>Cielo</span>
                <span className="font-semibold">Despejado</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/20 pb-2">
                <span>Máxima</span>
                <span className="font-semibold">33°C</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Recogida orgánica</span>
                <span className="font-semibold">Mañana, 7:00</span>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-5 -right-5 opacity-10">
            <MIcon name="filter_drama" className="text-[160px]" />
          </div>
        </div>
      </section>

      {/* Próximos eventos */}
      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="nv-section-title md:text-2xl">Próximos eventos</h2>
            <p className="mt-1 hidden text-on-surface-variant md:block">
              No te pierdas lo que pasa en el pueblo.
            </p>
          </div>
          <Link
            to="/eventos"
            className="flex items-center gap-2 text-sm font-semibold text-primary transition-transform hover:translate-x-1"
          >
            Ver todos <MIcon name="arrow_forward" className="text-[18px]" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-8">
          {proximos.map((e) => (
            <Link
              key={e.id}
              to="/eventos"
              className="group flex h-36 overflow-hidden rounded-xl bg-surface-container-lowest shadow-card transition-all hover:shadow-card-lg md:h-44"
            >
              <div className="flex w-1/3 items-center justify-center overflow-hidden bg-gradient-to-br from-primary-container to-primary text-on-primary-container">
                {imagenEvento(e) ? (
                  <img
                    src={imagenEvento(e).src}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ objectPosition: imagenEvento(e).pos || '50% 50%' }}
                  />
                ) : (
                  <IconoEvento categoria={e.categoria} className="text-[40px]" />
                )}
              </div>
              <div className="flex flex-1 flex-col justify-between p-4 md:p-6">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
                    {CATEGORIAS_EVENTO[e.categoria]?.nombre || 'Evento'}
                  </span>
                  <h3 className="mt-1 font-display text-base font-semibold transition-colors group-hover:text-primary md:text-lg">
                    {e.titulo}
                  </h3>
                  <p className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant">
                    <MIcon name="calendar_today" className="text-[16px]" />
                    {formatearFechaCorta(e.fecha)}
                    {e.hora ? `, ${e.hora}` : ''}
                  </p>
                </div>
                <p className="line-clamp-1 text-sm text-on-surface-variant">{e.lugar}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Participación */}
      <section className="rounded-xl bg-surface-container-low p-8 md:p-12">
        <div className="flex flex-col items-start gap-8 md:flex-row md:items-center">
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-primary md:text-3xl">
              Tu voz importa en Navalcarnero
            </h2>
            <p className="mt-3 max-w-xl text-on-surface-variant">
              Esta plaza digital la construimos entre todos. Pregunta al asistente, sugiere
              comercios que falten y mantente al día de la vida del pueblo.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                to="/asistente"
                className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition-all hover:bg-primary-container active:scale-95 md:hidden"
              >
                Preguntar al asistente
              </Link>
              <button
                type="button"
                onClick={abrirChat}
                className="hidden rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition-all hover:bg-primary-container active:scale-95 md:inline-flex"
              >
                Preguntar al asistente
              </button>
              <Link
                to="/mapa"
                className="rounded-lg border border-outline px-6 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
              >
                Sugerir un comercio
              </Link>
            </div>
          </div>
          <div className="hidden h-40 w-40 items-center justify-center rounded-full border-4 border-dashed border-outline-variant bg-surface-container-lowest md:flex">
            <MIcon name="groups" className="text-[56px] text-primary" fill />
          </div>
        </div>
      </section>
    </div>
  )
}
