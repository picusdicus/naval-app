import { useEffect, useState } from 'react'
import scheduleData from '../data/horarios-bus.json'
import {
  getDayType,
  DAY_TYPE_LABELS,
  getNextDepartures,
  getFirstDepartureNextDay,
} from '../lib/busSchedule.js'
import { useRealTime } from '../hooks/useRealTime.js'
import { useNearbyStops } from '../hooks/useNearbyStops.js'
import MIcon from '../components/MIcon.jsx'

function Direction({ direction, now }) {
  const nextDepartures = getNextDepartures(direction.horarios, now, 3)
  const tomorrowFirstDeparture = getFirstDepartureNextDay(direction.horarios, now)
  const realTime = useRealTime(direction.codParada)

  return (
    <div className="border-t border-filete pt-3">
      <p className="flex items-center gap-1.5 font-serif-spectral text-sm font-semibold text-tinta">
        <MIcon name="arrow_forward" className="text-[16px] text-terracota" />
        {direction.destino}
      </p>
      <p className="mt-0.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
        Desde {direction.parada}
      </p>
      {nextDepartures.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono-ibm text-xs">
          {nextDepartures.map((departure, i) =>
            i === 0 ? (
              <span key={departure.time} className="bg-tinta px-3 py-1 text-papel">
                {departure.time} ·{' '}
                {realTime && realTime.length > 0
                  ? `${realTime[0].minutes} min (tiempo real 🟢)`
                  : departure.minutesUntil === 0
                    ? 'ahora'
                    : `en ${departure.minutesUntil} min`}
              </span>
            ) : (
              <span key={departure.time} className="border border-filete px-3 py-1 text-pardo">
                {departure.time}
              </span>
            ),
          )}
        </div>
      ) : (
        <p className="mt-2 font-serif-spectral text-sm text-pardo">
          No quedan salidas hoy{tomorrowFirstDeparture ? ` · mañana a las ${tomorrowFirstDeparture}` : ''}
        </p>
      )}
    </div>
  )
}

function TabButton({ label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-1 pb-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta transition-colors ${
        isActive
          ? 'border-b-2 border-terracota text-tinta'
          : 'border-b-2 border-transparent text-pardo hover:text-tinta'
      }`}
    >
      {label}
    </button>
  )
}

function NearbyStop({ stop, realTimes }) {
  const arrivals = realTimes[stop.codStop]
  const formattedDistance =
    stop.distance < 1000 ? `${Math.round(stop.distance)} m` : `${(stop.distance / 1000).toFixed(1)} km`

  // Fallback when no real-time data: show the lines that pass through this stop
  const displayedLines =
    arrivals && arrivals.length > 0
      ? arrivals
      : stop.codLines?.slice(0, 3).map((line) => ({
          line,
          destination: 'Destino próximamente',
          minutes: '--',
          isFallback: true,
        }))

  return (
    <div className="gz-tarjeta-impresa space-y-3 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-serif-dm text-lg leading-tight text-tinta">{stop.name}</h3>
          <p className="mt-0.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
            {formattedDistance}
          </p>
        </div>
        <MIcon name="location_on" className="text-[20px] text-terracota" />
      </div>

      {displayedLines && displayedLines.length > 0 ? (
        <div className="space-y-2">
          {displayedLines.slice(0, 3).map((arrival, i) => (
            <div key={i} className="flex items-center justify-between border border-filete p-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 min-w-[24px] flex-none items-center justify-center bg-tinta px-1 font-mono-ibm text-xs font-bold text-papel">
                  {arrival.line}
                </div>
                <div className="flex-1 font-serif-spectral text-xs text-pardo">{arrival.destination}</div>
              </div>
              <span className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                {arrival.isFallback ? 'Cargando' : `en ${arrival.minutes} min`}
              </span>
            </div>
          ))}
          <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
            {arrivals && arrivals.length > 0 ? 'Próximas llegadas en tiempo real' : 'Líneas que pasan por esta parada'}
          </p>
        </div>
      ) : (
        <p className="font-serif-spectral text-sm text-pardo">Cargando próximas llegadas...</p>
      )}
    </div>
  )
}

function TarjetaLinea({ line, now }) {
  return (
    <article className="gz-tarjeta-impresa space-y-3 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 min-w-[3.5rem] flex-none items-center justify-center bg-tinta px-2 font-mono-ibm text-base font-bold text-papel">
          {line.numero}
        </div>
        <h2 className="font-serif-dm text-lg leading-tight text-tinta">{line.nombre}</h2>
      </div>
      {line.sentidos.map((direction) => (
        <Direction key={direction.destino} direction={direction} now={now} />
      ))}
    </article>
  )
}

function CajaInfo({ titulo, children }) {
  return (
    <section className="border border-tinta bg-papel-calido p-5">
      <div className="flex items-start gap-4">
        <MIcon name="info" className="mt-0.5 text-[20px] text-terracota" fill />
        <div>
          <h3 className="font-serif-dm text-lg leading-tight text-tinta">{titulo}</h3>
          <p className="mt-1 font-serif-spectral text-sm text-tinta-apagada">{children}</p>
        </div>
      </div>
    </section>
  )
}

export default function Transport() {
  const [now, setNow] = useState(() => new Date())
  const [tab, setTab] = useState('nearby')
  const { stops, realTimes, loading, geoError } = useNearbyStops()

  // If geolocation fails, switch to lines tab
  useEffect(() => {
    if (geoError && !loading && tab === 'nearby') {
      setTab('lines')
    }
  }, [geoError, loading, tab])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const dayType = getDayType(now)

  const shouldShowNearbyStops = tab === 'nearby' && !geoError && stops.length > 0
  const showNearbyStopsView = shouldShowNearbyStops
  const showLinesView = !shouldShowNearbyStops

  return (
    <div className="mx-auto max-w-3xl">
      {/* Masthead */}
      <header className="gz-filete-doble pb-3">
        <div className="gz-label text-mudo">Cómo moverse por</div>
        <h1 className="font-serif-dm text-seccion leading-none text-tinta">Transporte</h1>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta">
        <span className="bg-papel-calido px-3 py-1 text-tinta">
          Hoy: horario de {DAY_TYPE_LABELS[dayType]}
        </span>
        <span className="border border-filete px-3 py-1 text-pardo">
          Datos del {scheduleData.actualizado}
        </span>
      </div>

      <div className="mt-6 border-b border-tinta">
        <div className="flex gap-5">
          <TabButton label="Cerca de mí" isActive={tab === 'nearby'} onClick={() => setTab('nearby')} />
          <TabButton label="Todas las líneas" isActive={tab === 'lines'} onClick={() => setTab('lines')} />
        </div>
      </div>

      {showNearbyStopsView && (
        <section className="mt-6 space-y-4">
          {loading ? (
            <div className="gz-tarjeta-impresa p-5 text-center">
              <p className="font-serif-spectral text-sm text-pardo">Buscando paradas cercanas...</p>
            </div>
          ) : stops.length > 0 ? (
            <>
              <div className="space-y-3">
                {stops.map((stop) => (
                  <NearbyStop key={stop.codStop} stop={stop} realTimes={realTimes} />
                ))}
              </div>
              <CajaInfo titulo="Sobre estos datos">
                Horarios oficiales del CRTM con tiempos de llegada en tiempo real cuando están
                disponibles. Puede haber variaciones por tráfico u obras.
              </CajaInfo>
            </>
          ) : (
            <div className="space-y-4">
              <div className="gz-tarjeta-impresa p-5">
                <p className="text-center font-serif-spectral text-sm text-pardo">
                  No hay paradas de autobús en un radio de 600 metros. Consulta todas las líneas abajo.
                </p>
              </div>
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {scheduleData.lineas.map((line) => (
                  <TarjetaLinea key={line.numero} line={line} now={now} />
                ))}
              </section>
            </div>
          )}
        </section>
      )}

      {showLinesView && (
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {scheduleData.lineas.map((line) => (
            <TarjetaLinea key={line.numero} line={line} now={now} />
          ))}
        </section>
      )}

      {!showNearbyStopsView && (
        <div className="mt-4">
          <CajaInfo titulo="Sobre estos horarios">
            Horarios oficiales publicados por el Consorcio Regional de Transportes de Madrid
            (datos.crtm.es). Las cuentas atrás se calculan con el horario programado; puede haber
            variaciones por tráfico u obras. Actualiza los datos con{' '}
            <code className="bg-papel px-1 py-0.5 font-mono-ibm text-xs">npm run fetch:transporte</code>.
          </CajaInfo>
        </div>
      )}
    </div>
  )
}
