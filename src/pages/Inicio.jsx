import { useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { proximosEventos, formatearFechaCorta } from '../lib/eventos.js'
import { CATEGORIAS_EVENTO } from '../lib/eventos.js'
import { IconoEvento } from '../components/eventos/iconosEvento.jsx'
import { imagenEvento } from '../lib/imagenesEvento.js'
import { cartelDe } from '../lib/gaceta.js'
import { useEventosPublicos } from '../lib/useEventosPublicos.js'
import { useDestacados } from '../lib/useDestacados.js'
import { useWeather } from '../hooks/useWeather.js'
import MIcon from '../components/MIcon.jsx'
import CarruselDestacados from '../components/destacados/CarruselDestacados.jsx'

const EVENTOS_EN_PORTADA = 6

// Fecha corta para el masthead: "Mar · 21 Julio".
function fechaMasthead() {
  const d = new Date()
  const dia = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(d).replace('.', '')
  const num = d.getDate()
  const mes = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(d)
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
  return `${cap(dia)} · ${num} ${cap(mes)}`
}

// Avisos del municipio (estáticos por ahora; no hay fuente de datos detrás —
// mismos dos que la referencia de diseño). Marcador § terracota/verde.
const AVISOS_MUNICIPIO = [
  {
    color: 'text-terracota',
    titulo: 'Corte de agua programado',
    detalle: 'Bº de la Estación · martes 8:00–14:00',
  },
  {
    color: 'text-verde',
    titulo: 'Obras finalizadas',
    detalle: 'Av. del Parque · abierta al tráfico',
  },
]

export default function Inicio() {
  const { abrirChat } = useOutletContext()
  const weather = useWeather()

  // Las tres fuentes de la agenda: los dos JSON y los eventos publicados desde
  // /admin, que llegan por fetch. Se recalcula cuando llegan, no al cargar el
  // módulo, o los eventos de la base de datos nunca aparecerían.
  const { eventos } = useEventosPublicos()
  const proximos = useMemo(() => proximosEventos(eventos, EVENTOS_EN_PORTADA), [eventos])

  // Teaser mixto (eventos + comercios) contratados como destacados.
  const { items: destacados } = useDestacados({ eventos })

  const semana = proximos.slice(0, 4)

  return (
    <>
      {/* ═════════════ Móvil · La Gaceta (ref. 1a) ═════════════ */}
      <div className="md:hidden">
        {/* Masthead */}
        <div className="flex items-center justify-between font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
          <span>{fechaMasthead()}</span>
          <span className="flex items-center gap-1">
            {!weather.loading && (
              <>
                <MIcon name={weather.current.icon} className="text-[14px]" fill />
                {weather.current.temp}°
              </>
            )}
          </span>
        </div>
        <div className="gz-filete-doble mt-2" />

        {/* Portada · Destacados */}
        {destacados.length > 0 && (
          <section className="mt-5 animate-rise">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="gz-eyebrow">Portada · Destacados</span>
              <span className="font-mono-ibm text-[10px] tracking-etiqueta text-mudo">
                {String(Math.min(destacados.length, 5)).padStart(2, '0')} / {String(destacados.length).padStart(2, '0')}
              </span>
            </div>
            <CarruselDestacados items={destacados} columnas={4} seccion="inicio" />
          </section>
        )}

        {/* También esta semana */}
        {semana.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 h-px bg-tinta" />
            <span className="gz-label text-mudo">También esta semana</span>
            <div className="mt-3 grid grid-cols-2 gap-4">
              {semana.map((e) => {
                const img = imagenEvento(e)
                const cartel = cartelDe(e.categoria)
                return (
                  <Link key={e.id} to={`/eventos/${e.id}`} className="border-t-2 border-tinta pt-2">
                    <div
                      className={`relative aspect-square overflow-hidden ${img ? '' : cartel.trama}`}
                      style={img ? undefined : { background: cartel.fondo }}
                    >
                      {img ? (
                        <img
                          src={img.src}
                          alt=""
                          className="h-full w-full object-cover"
                          style={{ objectPosition: img.pos || '50% 50%' }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-25">
                          <IconoEvento categoria={e.categoria} className="text-[40px] text-white" />
                        </div>
                      )}
                    </div>
                    <h3 className="mt-1.5 font-serif-dm text-lg leading-none text-tinta">{e.titulo}</h3>
                    <div className="mt-1 font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-pardo">
                      {formatearFechaCorta(e.fecha)}
                      {e.hora ? ` · ${e.hora}` : ''}
                    </div>
                  </Link>
                )
              })}
            </div>
            <Link
              to="/eventos"
              className="mt-4 block border-t border-filete pt-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota"
            >
              Ver toda la agenda →
            </Link>
          </section>
        )}

        {/* Del municipio */}
        <section className="mt-8">
          <div className="mb-3 h-px bg-tinta" />
          <span className="gz-label text-mudo">Del municipio</span>
          <div className="mt-3 border border-tinta">
            {AVISOS_MUNICIPIO.map((a, i) => (
              <div
                key={a.titulo}
                className={`flex gap-2.5 p-3.5 ${i > 0 ? 'border-t border-dashed border-filete-punteado' : ''}`}
              >
                <span className={`font-serif-dm text-xl leading-none ${a.color}`}>§</span>
                <div>
                  <div className="font-serif-spectral text-sm font-semibold text-tinta">{a.titulo}</div>
                  <div className="font-serif-spectral text-[12.5px] text-tinta-apagada">{a.detalle}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ═════════════ Escritorio · sistema anterior (se rehace en Fase 2) ═════════════ */}
      <div className="hidden space-y-16 md:block">
        {/* Hero: Plaza de Segovia (foto: D.G. Turismo de la Comunidad de Madrid,
            CC BY 3.0 ES, vía Wikimedia Commons) */}
        <section className="relative h-[420px] overflow-hidden rounded-xl shadow-card">
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
          <div className="relative flex h-full flex-col justify-end p-12 text-white">
            <h1 className="max-w-2xl font-display text-5xl font-bold leading-tight">
              Bienvenido a tu plaza digital
            </h1>
            <p className="mt-3 max-w-xl text-lg opacity-90">
              Conectando Navalcarnero a través de la información local, los eventos y los servicios
              vecinales.
            </p>
            <div className="mt-6 flex gap-4">
              <Link
                to="/eventos"
                className="rounded-lg bg-secondary-container px-8 py-3 text-sm font-semibold text-on-secondary-container transition-all hover:opacity-90"
              >
                Ver eventos
              </Link>
              <Link
                to="/comercios"
                className="rounded-lg bg-white/70 px-8 py-3 text-sm font-semibold text-on-surface backdrop-blur transition-all hover:bg-white"
              >
                Ver comercios
              </Link>
            </div>
          </div>
        </section>

        {destacados.length > 0 && (
          <section>
            <div className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="nv-section-title flex items-center gap-2 md:text-2xl">
                  <MIcon name="kid_star" className="text-[22px]" fill />
                  Destacados
                </h2>
                <p className="mt-1 text-on-surface-variant">Lo que no te puedes perder estos días.</p>
              </div>
            </div>
            <CarruselDestacados items={destacados} columnas={4} seccion="inicio" />
          </section>
        )}

        <section className="grid grid-cols-12 gap-8">
          <div className="col-span-12 space-y-4 lg:col-span-8">
            <div className="flex items-center justify-between">
              <h2 className="nv-section-title md:text-2xl">Estado del municipio</h2>
              <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold text-on-secondary-container">
                Todo operativo
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border-l-4 border-error bg-surface-container-lowest p-6 shadow-card">
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
              <div className="rounded-xl border-l-4 border-secondary bg-surface-container-lowest p-6 shadow-card">
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

          <div className="relative col-span-12 flex flex-col justify-between overflow-hidden rounded-xl bg-primary-container p-8 text-on-primary-container lg:col-span-4">
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold opacity-70">Navalcarnero</div>
                  <div className="font-display text-4xl font-bold text-white">
                    {weather.loading ? '...' : `${weather.current.temp}°C`}
                  </div>
                </div>
                <MIcon name={weather.current.icon} className="text-4xl" fill />
              </div>
              <div className="mt-8 space-y-4 text-sm">
                <div className="flex items-center justify-between border-b border-white/20 pb-2">
                  <span>Cielo</span>
                  <span className="font-semibold">{weather.current.condition}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/20 pb-2">
                  <span>Máxima</span>
                  <span className="font-semibold">{weather.loading ? '--' : `${weather.max}°C`}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span>Datos de Open-Meteo</span>
                  <span className="font-semibold">{weather.error ? '⚠️' : '✓'}</span>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-5 -right-5 opacity-10">
              <MIcon name="filter_drama" className="text-[160px]" />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="nv-section-title md:text-2xl">Próximos eventos</h2>
              <p className="mt-1 text-on-surface-variant">No te pierdas lo que pasa en el pueblo.</p>
            </div>
            <Link
              to="/eventos"
              className="flex items-center gap-2 text-sm font-semibold text-primary transition-transform hover:translate-x-1"
            >
              Ver todos <MIcon name="arrow_forward" className="text-[18px]" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {proximos.map((e) => (
              <Link
                key={e.id}
                to={`/eventos/${e.id}`}
                className="group flex h-44 overflow-hidden rounded-xl bg-surface-container-lowest shadow-card transition-all hover:shadow-card-lg"
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
                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
                      {CATEGORIAS_EVENTO[e.categoria]?.nombre || 'Evento'}
                    </span>
                    <h3 className="mt-1 font-display text-lg font-semibold transition-colors group-hover:text-primary">
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

        <section className="rounded-xl bg-surface-container-low p-12">
          <div className="flex flex-col items-start gap-8 md:flex-row md:items-center">
            <div className="flex-1">
              <h2 className="font-display text-3xl font-bold text-primary">
                Tu voz importa en Navalcarnero
              </h2>
              <p className="mt-3 max-w-xl text-on-surface-variant">
                Esta plaza digital la construimos entre todos. Pregunta al asistente, sugiere
                comercios que falten y mantente al día de la vida del pueblo.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={abrirChat}
                  className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition-all hover:bg-primary-container active:scale-95"
                >
                  Preguntar al asistente
                </button>
                <Link
                  to="/comercios"
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
    </>
  )
}
