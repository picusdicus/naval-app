import { useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { proximosEventos, formatearFechaCorta } from '../lib/eventos.js'
import { CATEGORIAS_EVENTO } from '../lib/eventos.js'
import { IconoEvento } from '../components/eventos/iconosEvento.jsx'
import { imagenEvento } from '../lib/imagenesEvento.js'
import { cartelDe } from '../lib/gaceta.js'
import { useEventosPublicos } from '../lib/useEventosPublicos.js'
import { useDestacados } from '../lib/useDestacados.js'
import { ETIQUETAS_ALERTA, useNoticiasPublicas } from '../lib/useNoticiasPublicas.js'
import { useWeather } from '../hooks/useWeather.js'
import { CATEGORIAS } from '../lib/categorias.js'
import comerciosData from '../data/comercios.json'
import MIcon from '../components/MIcon.jsx'
import CarruselDestacados from '../components/destacados/CarruselDestacados.jsx'
import CarruselDesktopInmersivo from '../components/destacados/CarruselDesktopInmersivo.jsx'

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

export default function Inicio() {
  const { abrirChat } = useOutletContext()
  const weather = useWeather()

  // Alertas urgentes vigentes del Ayuntamiento (Instagram → Neon), filtradas
  // client-side en el hook: sin ninguna activa, la sección móvil se oculta y
  // la de escritorio muestra "Todo operativo".
  const { alertas } = useNoticiasPublicas()

  // Las tres fuentes de la agenda: los dos JSON y los eventos publicados desde
  // /admin, que llegan por fetch. Se recalcula cuando llegan, no al cargar el
  // módulo, o los eventos de la base de datos nunca aparecerían.
  const { eventos } = useEventosPublicos()
  const proximos = useMemo(() => proximosEventos(eventos, EVENTOS_EN_PORTADA), [eventos])

  // Teaser mixto (eventos + comercios) contratados como destacados.
  const { items: destacados } = useDestacados({ eventos })

  const semana = proximos.slice(0, 4)
  // Tres comercios bien poblados y distintos para la banda de escritorio (mockup
  // 4a); se deduplica por nombre (hay varias sedes de la misma cadena).
  const comerciosBanda = useMemo(() => {
    const vistos = new Set()
    const out = []
    for (const c of comerciosData) {
      if (c.rating == null || !c.horario || vistos.has(c.nombre)) continue
      vistos.add(c.nombre)
      out.push(c)
      if (out.length === 3) break
    }
    return out
  }, [])

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

        {/* Del municipio: solo con alertas urgentes vigentes */}
        {alertas.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 h-px bg-tinta" />
            <span className="gz-label text-mudo">Del municipio</span>
            <div className="mt-3 border border-tinta">
              {alertas.map((a, i) => (
                <Link
                  key={a.id}
                  to={`/noticias/${a.id}`}
                  className={`flex gap-2.5 p-3.5 transition-colors hover:bg-papel-calido ${i > 0 ? 'border-t border-dashed border-filete-punteado' : ''}`}
                >
                  <span className="font-serif-dm text-xl leading-none text-terracota">§</span>
                  <div>
                    <div className="font-serif-spectral text-sm font-semibold text-tinta">{a.titulo}</div>
                    <div className="line-clamp-2 font-serif-spectral text-[12.5px] text-tinta-apagada">
                      {a.resumen || ETIQUETAS_ALERTA[a.tipoAlerta]}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ═════════════ Escritorio · La Gaceta (ref. 4a) ═════════════ */}
      <div className="hidden space-y-16 md:block">
        {/* Carrusel inmersivo de destacados */}
        {destacados.length > 0 && <CarruselDesktopInmersivo items={destacados} seccion="inicio" />}

        {/* Agenda de la semana */}
        {semana.length > 0 && (
          <section>
            <div className="mb-6 flex items-end justify-between">
              <div>
                <div className="gz-eyebrow">Qué hacer estos días</div>
                <h2 className="mt-1.5 font-serif-dm text-seccion text-tinta">Agenda de la semana</h2>
              </div>
              <Link
                to="/eventos"
                className="font-serif-spectral text-terracota transition-transform hover:translate-x-1"
              >
                Ver todo →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {semana.map((e) => {
                const img = imagenEvento(e)
                const cartel = cartelDe(e.categoria)
                return (
                  <Link key={e.id} to={`/eventos/${e.id}`} className="group">
                    <div
                      className={`relative aspect-[3/4] overflow-hidden rounded-lg shadow-cartel ${img ? '' : cartel.trama}`}
                      style={img ? undefined : { background: cartel.fondo }}
                    >
                      {img ? (
                        <img
                          src={img.src}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          style={{ objectPosition: img.pos || '50% 50%' }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-25">
                          <IconoEvento categoria={e.categoria} className="text-[64px] text-white" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <span className="gz-badge-oro absolute left-3 top-3">
                        {CATEGORIAS_EVENTO[e.categoria]?.nombre || 'Evento'}
                      </span>
                      <h3 className="absolute bottom-0 left-0 w-full p-4 font-serif-dm text-2xl italic leading-none text-papel">
                        {e.titulo}
                      </h3>
                    </div>
                    <div className="mt-2.5 font-serif-spectral text-sm text-pardo">
                      {formatearFechaCorta(e.fecha)}
                      {e.hora ? ` · ${e.hora}` : ''} · {e.lugar}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Banda de comercios (a sangre dentro del marco) */}
        <section className="-mx-10 bg-papel-calido px-10 py-11">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <div className="gz-eyebrow">Compra en el pueblo</div>
              <h2 className="mt-1.5 font-serif-dm text-seccion text-tinta">
                Los comercios de Navalcarnero
              </h2>
            </div>
            <Link to="/comercios" className="gz-boton-pill-tinta">
              Explorar los comercios →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {comerciosBanda.map((c) => {
              const cat = CATEGORIAS[c.categoria]
              return (
                <Link
                  key={c.id}
                  to={`/comercios?comercio=${c.id}`}
                  className="flex gap-4 rounded-lg bg-papel p-6 shadow-tarjeta-gaceta transition-shadow hover:shadow-cartel"
                >
                  <div
                    className="flex h-14 w-14 flex-none items-center justify-center font-serif-dm text-2xl text-papel"
                    style={{ backgroundColor: cat?.color || '#4a5b41' }}
                  >
                    {c.nombre.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-serif-dm text-xl leading-tight text-tinta">{c.nombre}</div>
                    <div className="truncate font-serif-spectral text-[13.5px] text-pardo">
                      {cat?.nombre}
                      {c.direccion ? ` · ${c.direccion}` : ''}
                    </div>
                    {c.rating != null && (
                      <div className="mt-2 font-mono-ibm text-[11px] text-ocre">★ {c.rating.toFixed(1)}</div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Estado del municipio + tiempo. La sección se mantiene siempre (la
            tarjeta de clima vive aquí); solo las alertas son condicionales. */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-serif-dm text-seccion text-tinta">Estado del municipio</h2>
            {alertas.length > 0 ? (
              <span className="bg-terracota px-3 py-1 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel">
                ⚠ {alertas.length} {alertas.length === 1 ? 'aviso activo' : 'avisos activos'}
              </span>
            ) : (
              <span className="bg-verde px-3 py-1 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel">
                ✓ Todo operativo
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {alertas.slice(0, 2).map((a) => (
              <Link
                key={a.id}
                to={`/noticias/${a.id}`}
                className="border-l-4 border-terracota bg-papel-claro p-6 transition-colors hover:bg-papel-calido"
              >
                <div className="gz-label text-terracota">{ETIQUETAS_ALERTA[a.tipoAlerta] || 'Aviso'}</div>
                <h3 className="mt-2 font-serif-dm text-xl leading-tight text-tinta">{a.titulo}</h3>
                <p className="mt-1.5 line-clamp-3 font-serif-spectral text-sm text-tinta-apagada">
                  {a.resumen}
                </p>
              </Link>
            ))}
            {/* Tarjeta de clima */}
            <div className="flex flex-col justify-between overflow-hidden bg-verde-bosque p-6 text-papel">
              <div className="flex items-start justify-between">
                <div>
                  <div className="gz-label text-verde-salvia-claro">El tiempo hoy</div>
                  <div className="mt-1 font-serif-dm text-5xl leading-none text-papel">
                    {weather.loading ? '--' : `${weather.current.temp}°`}
                  </div>
                </div>
                <MIcon name={weather.current.icon} className="text-[28px]" fill />
              </div>
              <div className="mt-4 font-serif-spectral text-sm">
                <div className="flex justify-between border-t border-verde-bosque-borde py-1.5">
                  <span className="text-verde-salvia-claro">Cielo</span>
                  <span>{weather.current.condition}</span>
                </div>
                <div className="flex justify-between border-t border-verde-bosque-borde py-1.5">
                  <span className="text-verde-salvia-claro">Máxima</span>
                  <span>{weather.loading ? '--' : `${weather.max}°`}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Participación */}
        <section className="border border-tinta bg-papel-calido p-12">
          <div className="flex flex-col items-start gap-8 md:flex-row md:items-center">
            <div className="flex-1">
              <h2 className="font-serif-dm text-seccion text-tinta">Tu voz importa en Navalcarnero</h2>
              <p className="mt-3 max-w-xl font-serif-spectral text-tinta-apagada">
                Esta plaza digital la construimos entre todos. Pregunta al asistente, sugiere
                comercios que falten y mantente al día de la vida del pueblo.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <button type="button" onClick={abrirChat} className="gz-boton-pill-tinta">
                  Preguntar al asistente
                </button>
                <Link
                  to="/comercios"
                  className="rounded-full border border-tinta px-6 py-3 font-serif-spectral text-tinta transition-colors hover:bg-papel"
                >
                  Sugerir un comercio
                </Link>
              </div>
            </div>
            <div className="hidden h-40 w-40 flex-none items-center justify-center rounded-full border-4 border-dashed border-filete-punteado md:flex">
              <MIcon name="groups" className="text-[56px] text-terracota" fill />
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
