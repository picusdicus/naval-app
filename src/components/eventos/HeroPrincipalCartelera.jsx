import { useState, useEffect, useMemo } from 'react'
import MIcon from '../MIcon'
import { cartelDe } from '../../lib/gaceta'
import { imagenEvento } from '../../lib/imagenesEvento'

// Nº objetivo de carteles en el carrusel: los destacados vigentes se rellenan
// con los eventos más próximos hasta llegar aquí (si hay más destacados, salen
// todos). Es solo el tamaño de la rotación; en pantalla se ve uno cada vez.
const OBJETIVO_CARRUSEL = 5

/**
 * Apertura inmersiva de la cartelera (global, no depende del día seleccionado).
 * Rota por los eventos destacados (contratados) en el orden del superadmin y,
 * si no llegan a llenar el carrusel, rellena con los eventos más próximos.
 * - El cartel real (si existe) va desenfocado como fondo y nítido a la izquierda.
 * - Sin cartel real: degradado de categoría + título en serif grande.
 * - Rotación automática cada 5 s (respeta prefers-reduced-motion) con puntos.
 */
export default function HeroPrincipalCartelera({
  proximos = [],
  destacados = [],
  categoriasActivas = [],
  onVerEvento = () => {},
}) {
  const enCategoria = (e) =>
    categoriasActivas.length === 0 || categoriasActivas.includes(e.categoria)

  // Índice de eventos PRÓXIMOS por id público (bd-<uuid>, ids secundarios de
  // fusión…). Resolver contra `proximos` descarta de paso los destacados cuyo
  // evento ya pasó: no están en la lista.
  const proximosPorRefId = useMemo(() => {
    const mapa = new Map()
    proximos.forEach((e) => {
      mapa.set(e.id, e)
      if (e.idsSecundarios) e.idsSecundarios.forEach((s) => mapa.set(s, e))
      if (e.id.startsWith('bd-')) mapa.set(e.id.slice(3), e)
    })
    return mapa
  }, [proximos])

  // Carrusel: destacados vigentes (en su orden) + relleno con los más próximos.
  const eventosCarrusel = useMemo(() => {
    const vistos = new Set()
    const lista = []

    // 1) Destacados contratados, en el orden del superadmin, si su evento sigue
    //    vigente (está en `proximos`) y cumple el filtro de categoría.
    ;[...destacados]
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .forEach((d) => {
        const e = proximosPorRefId.get(d.referenciaId)
        if (e && enCategoria(e) && !vistos.has(e.id)) {
          vistos.add(e.id)
          lista.push(e)
        }
      })

    // 2) Relleno: los eventos más próximos que no estén ya, hasta el objetivo.
    //    `proximos` ya viene ordenado ascendente por fecha.
    for (const e of proximos) {
      if (lista.length >= OBJETIVO_CARRUSEL) break
      if (enCategoria(e) && !vistos.has(e.id)) {
        vistos.add(e.id)
        lista.push(e)
      }
    }

    return lista
  }, [destacados, proximos, proximosPorRefId, categoriasActivas])

  const [indiceActual, setIndiceActual] = useState(0)
  const [pausado, setPausado] = useState(false)

  // Al cambiar el filtro la lista cambia: volver al primero para no quedar
  // fuera de rango.
  useEffect(() => {
    setIndiceActual(0)
  }, [categoriasActivas])

  // Rotación automática cada 5 s (salvo un solo evento o reduced-motion).
  useEffect(() => {
    if (eventosCarrusel.length <= 1 || pausado) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const intervalo = setInterval(() => {
      setIndiceActual((prev) => (prev + 1) % eventosCarrusel.length)
    }, 5000)
    return () => clearInterval(intervalo)
  }, [eventosCarrusel.length, pausado])

  const eventoActual = eventosCarrusel[indiceActual] || eventosCarrusel[0]
  if (!eventoActual) return null

  // Cartel real o, en su defecto, la foto temática por categoría; el degradado
  // queda solo como último recurso (categoría sin imagen asociada).
  const img = imagenEvento(eventoActual)
  const posterUrl = img?.src ?? null
  const { fondo, trama } = cartelDe(eventoActual.categoria)

  const precio = eventoActual.entradas?.precio || ''
  const urlEntradas = eventoActual.entradas?.url

  return (
    // En móvil rompe a sangre: -mx-5 cancela el px-5 lateral del <main> de
    // Layout (sin radio en los bordes). En md+ vuelve a ser tarjeta con margen
    // normal y esquinas redondeadas.
    <div className="relative -mx-5 mb-8 overflow-hidden animate-rise md:mx-0 md:rounded-2xl">
      {/* Fondo: cartel real desenfocado o degradado de categoría */}
      <div
        className="absolute inset-0"
        style={
          posterUrl
            ? {
                backgroundImage: `url(${posterUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(46px)',
                transform: 'scale(1.15)',
              }
            : { background: fondo }
        }
      />
      {/* Velo oscuro para legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />

      {/* Contenido */}
      <div className="relative flex flex-col gap-6 px-6 py-8 md:flex-row md:gap-8 md:px-8 md:py-12">
        {/* Cartel nítido (2:3) */}
        <div className="w-32 flex-shrink-0 sm:w-40 md:w-48 lg:w-56">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={eventoActual.titulo}
              style={{ objectPosition: img?.pos || '50% 50%' }}
              className="aspect-[2/3] w-full rounded-lg object-cover shadow-cartel"
              loading="eager"
            />
          ) : (
            <div
              className={`relative flex aspect-[2/3] w-full flex-col justify-end overflow-hidden rounded-lg p-4 shadow-cartel ${trama}`}
              style={{ background: fondo }}
            >
              <p className="font-serif-dm text-lg italic leading-tight text-papel">
                {eventoActual.titulo}
              </p>
            </div>
          )}
        </div>

        {/* Datos */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h1 className="mb-5 font-serif-dm text-4xl italic leading-[0.95] text-papel md:text-6xl lg:text-7xl">
            {eventoActual.titulo}
          </h1>

          {/* Columnas separadas por reglas: Hora / Lugar / Entrada */}
          <div className="mb-6 flex flex-wrap items-start gap-x-6 gap-y-3 border-t border-papel/25 pt-4">
            {eventoActual.hora && (
              <div className="flex flex-col">
                <span className="mb-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-papel/60">
                  Hora
                </span>
                <span className="font-serif-dm text-lg text-papel">{eventoActual.hora}</span>
              </div>
            )}
            <div className="flex flex-col border-l border-papel/25 pl-6">
              <span className="mb-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-papel/60">
                Lugar
              </span>
              <span className="font-serif-dm text-lg text-papel">{eventoActual.lugar}</span>
            </div>
            {precio && (
              <div className="flex flex-col border-l border-papel/25 pl-6">
                <span className="mb-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-papel/60">
                  Entrada
                </span>
                <span className="font-serif-dm text-lg text-papel">{precio}</span>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-3">
            {urlEntradas && (
              <a
                href={urlEntradas}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-papel px-6 py-2.5 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta transition hover:opacity-90"
              >
                Reservar entrada
              </a>
            )}
            <button
              type="button"
              onClick={() => onVerEvento(eventoActual)}
              className="inline-flex items-center gap-2 rounded-full border border-papel/70 px-6 py-2.5 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel transition hover:bg-papel/10"
            >
              Ver el cartel
              <MIcon name="arrow_forward" className="text-[15px]" />
            </button>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-papel/70 text-papel transition hover:bg-papel/10"
              aria-label="Guardar en favoritos"
            >
              <MIcon name="favorite_border" className="text-[18px]" />
            </button>
          </div>
        </div>
      </div>

      {/* Puntos del carrusel. Cada botón mide 44 px de alto (área de toque)
          aunque el punto visible sea pequeño. */}
      {eventosCarrusel.length > 1 && (
        <div
          className="relative flex justify-center pb-3"
          onMouseEnter={() => setPausado(true)}
          onMouseLeave={() => setPausado(false)}
        >
          {eventosCarrusel.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndiceActual(i)}
              className="flex h-11 items-center justify-center px-1.5"
              aria-label={`Destacado ${i + 1} de ${eventosCarrusel.length}`}
              aria-current={i === indiceActual}
            >
              <span
                className={`h-2 rounded-full transition-all ${
                  i === indiceActual ? 'w-6 bg-papel' : 'w-2 bg-papel/40'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
