import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MIcon from '../MIcon'
import { hoyISO } from '../../lib/fechas'

// "JULIO 2026" a partir de un ISO (sin el "de" que mete el locale).
function etiquetaMes(iso) {
  const fecha = new Date(`${iso}T00:00:00`)
  const mes = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(fecha)
  return `${mes} ${fecha.getFullYear()}`.toUpperCase()
}

/**
 * Tira de días: fila horizontal de sellos (día de semana + número + nº de actos).
 * Encima, una etiqueta de mes en mono que se actualiza dinámicamente al mes del
 * primer chip visible en el viewport de scroll (como un sticky de calendario),
 * porque la tira puede abarcar varios meses.
 */
export default function TiraDeHoras({
  eventosAgrupados = [],
  diaSeleccionado,
  categoriasActivas = [],
  onDiaSeleccionado = () => {},
  onAbrirCalendario = () => {},
}) {
  const scrollRef = useRef(null)
  const chipsRef = useRef(new Map()) // dia -> elemento del chip
  const rafRef = useRef(0)
  const [mesVisible, setMesVisible] = useState('')

  // Días con eventos (respetando el filtro), con su contador.
  const diasConEventos = useMemo(() => {
    return eventosAgrupados
      .filter(({ eventos }) =>
        categoriasActivas.length === 0
          ? eventos.length > 0
          : eventos.some((e) => categoriasActivas.includes(e.categoria))
      )
      .map(({ dia, eventos }) => ({
        dia,
        contador:
          categoriasActivas.length > 0
            ? eventos.filter((e) => categoriasActivas.includes(e.categoria)).length
            : eventos.length,
      }))
  }, [eventosAgrupados, categoriasActivas])

  const formatearDia = (iso) => {
    const fecha = new Date(`${iso}T00:00:00`)
    const abbr = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(fecha).toUpperCase()
    return { abbr, dia: parseInt(iso.split('-')[2], 10) }
  }

  // Recalcula el mes según el primer chip visible por la izquierda del viewport.
  const recalcularMes = useCallback(() => {
    const cont = scrollRef.current
    if (!cont) return
    const bordeIzq = cont.getBoundingClientRect().left
    for (const { dia } of diasConEventos) {
      const el = chipsRef.current.get(dia)
      if (!el) continue
      // Primer chip cuyo borde derecho sobrepasa el borde izquierdo del carril:
      // es el más a la izquierda todavía visible.
      if (el.getBoundingClientRect().right > bordeIzq + 1) {
        setMesVisible(etiquetaMes(dia))
        return
      }
    }
    // Si el bucle no eligió (todo a la izquierda), usa el último.
    const ultimo = diasConEventos[diasConEventos.length - 1]
    if (ultimo) setMesVisible(etiquetaMes(ultimo.dia))
  }, [diasConEventos])

  // Recalcula al montar y cada vez que cambian los días (p. ej. al filtrar).
  useEffect(() => {
    recalcularMes()
  }, [recalcularMes])

  // Recalcula al redimensionar (cambian las posiciones de los chips).
  useEffect(() => {
    const onResize = () => recalcularMes()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [recalcularMes])

  // Scroll de la tira: throttle con requestAnimationFrame.
  const onScroll = () => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      recalcularMes()
    })
  }

  const hoy = hoyISO()

  return (
    <div className="mb-6 w-full">
      {/* Cabecera: etiqueta de mes (izquierda) + acceso al calendario (derecha) */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono-ibm text-[11px] uppercase tracking-etiqueta text-mudo">
          {mesVisible}
        </span>
        <button
          type="button"
          onClick={onAbrirCalendario}
          className="inline-flex flex-shrink-0 items-center gap-1 font-mono-ibm text-[11px] uppercase font-semibold tracking-etiqueta text-tinta transition hover:text-terracota"
          title="Abrir calendario"
        >
          <MIcon name="calendar_month" className="text-sm" />
          <span className="hidden sm:inline">Calendario</span>
        </button>
      </div>

      {/* Carril de chips (scroll horizontal) con desvanecido a la derecha para
          indicar que hay más y no cortar el último chip a la mitad. */}
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="hide-scrollbar flex gap-2 overflow-x-auto pb-2 pr-8 md:gap-3"
        >
        {diasConEventos.map(({ dia, contador }) => {
          const { abbr, dia: num } = formatearDia(dia)
          const activo = dia === diaSeleccionado
          const esHoy = dia === hoy

          return (
            <button
              key={dia}
              ref={(el) => {
                if (el) chipsRef.current.set(dia, el)
                else chipsRef.current.delete(dia)
              }}
              onClick={() => onDiaSeleccionado(dia)}
              className={`flex flex-shrink-0 flex-col items-center justify-center rounded-full px-3 py-2 font-mono-ibm text-xs font-semibold tracking-wider transition-all ${
                activo
                  ? 'bg-tinta text-papel'
                  : 'border border-[#d9d0ba] bg-papel text-tinta hover:border-tinta'
              } ${esHoy ? 'ring-2 ring-terracota' : ''}`}
            >
              <span className="text-xs">{abbr}</span>
              <span className="-my-0.5 font-serif-dm text-lg">{num}</span>
              <span className={`text-xs ${activo ? 'text-papel/70' : 'text-pardo'}`}>
                {contador}
              </span>
            </button>
          )
        })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-papel to-transparent" />
      </div>
    </div>
  )
}
