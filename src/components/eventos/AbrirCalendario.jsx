import { useEffect, useMemo, useState } from 'react'
import MIcon from '../MIcon'
import { aFecha, aISO } from '../../lib/fechas'

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// Lunes = 0 … Domingo = 6 (getDay devuelve Domingo = 0).
function indiceSemana(fecha) {
  return (fecha.getDay() + 6) % 7
}

/**
 * Calendario en modal (bajo demanda desde la tira de días).
 * Muestra un mes con los días que tienen actos resaltados; al pulsar uno,
 * cierra y salta a la banda de ese día en el muro.
 */
export default function AbrirCalendario({
  abierto,
  eventosAgrupados = [],
  categoriasActivas = [],
  diaSeleccionado,
  onSeleccionar = () => {},
  onCerrar = () => {},
}) {
  // Mes visible: arranca en el del día seleccionado.
  const [mesVisible, setMesVisible] = useState(() =>
    diaSeleccionado ? aFecha(diaSeleccionado) : new Date()
  )

  // Reajusta el mes cada vez que se abre.
  useEffect(() => {
    if (abierto && diaSeleccionado) setMesVisible(aFecha(diaSeleccionado))
  }, [abierto, diaSeleccionado])

  // Cierra con Escape.
  useEffect(() => {
    if (!abierto) return
    const onKey = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto, onCerrar])

  // Recuento de actos por día (respetando el filtro de categoría) para el mes.
  const actosPorDia = useMemo(() => {
    const mapa = new Map()
    eventosAgrupados.forEach(({ dia, eventos }) => {
      const n =
        categoriasActivas.length > 0
          ? eventos.filter((e) => categoriasActivas.includes(e.categoria)).length
          : eventos.length
      if (n > 0) mapa.set(dia, n)
    })
    return mapa
  }, [eventosAgrupados, categoriasActivas])

  if (!abierto) return null

  const anio = mesVisible.getFullYear()
  const mes = mesVisible.getMonth()
  const primerDia = new Date(anio, mes, 1)
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const offset = indiceSemana(primerDia)

  const etiquetaMes = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
  }).format(primerDia)

  const celdas = []
  for (let i = 0; i < offset; i++) celdas.push(null)
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d)

  const cambiarMes = (delta) => setMesVisible(new Date(anio, mes + delta, 1))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/60 p-4"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Calendario de eventos"
    >
      <div
        className="w-full max-w-sm rounded-lg border border-tinta bg-papel p-5 shadow-cartel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif-dm text-xl text-tinta">
            {etiquetaMes.charAt(0).toUpperCase() + etiquetaMes.slice(1)}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => cambiarMes(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-tinta transition hover:bg-papel-calido"
              aria-label="Mes anterior"
            >
              <MIcon name="chevron_left" className="text-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => cambiarMes(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-tinta transition hover:bg-papel-calido"
              aria-label="Mes siguiente"
            >
              <MIcon name="chevron_right" className="text-[18px]" />
            </button>
            <button
              type="button"
              onClick={onCerrar}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-tinta transition hover:bg-papel-calido"
              aria-label="Cerrar"
            >
              <MIcon name="close" className="text-[18px]" />
            </button>
          </div>
        </div>

        {/* Cabecera de días */}
        <div className="mb-1 grid grid-cols-7 gap-1">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className="text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Rejilla de días */}
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((dNum, i) => {
            if (dNum === null) return <div key={`v-${i}`} />
            const iso = aISO(new Date(anio, mes, dNum))
            const n = actosPorDia.get(iso) || 0
            const tieneActos = n > 0
            const activo = iso === diaSeleccionado

            return (
              <button
                key={iso}
                type="button"
                disabled={!tieneActos}
                onClick={() => onSeleccionar(iso)}
                className={`flex aspect-square flex-col items-center justify-center rounded transition ${
                  activo
                    ? 'bg-tinta text-papel'
                    : tieneActos
                      ? 'text-tinta hover:bg-terracota-fondo'
                      : 'text-mudo/50'
                }`}
              >
                <span className="font-serif-dm text-sm leading-none">{dNum}</span>
                {tieneActos && (
                  <span
                    className={`mt-0.5 h-1 w-1 rounded-full ${
                      activo ? 'bg-papel' : 'bg-terracota'
                    }`}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
