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
    <div className="border-t border-surface-container-high pt-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
        <MIcon name="arrow_forward" className="text-[16px] text-secondary" />
        {direction.destino}
      </p>
      <p className="mt-0.5 text-xs text-on-surface-variant">Desde {direction.parada}</p>
      {nextDepartures.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {nextDepartures.map((departure, i) =>
            i === 0 ? (
              <span
                key={departure.time}
                className="rounded-full bg-secondary-container px-3 py-1 text-sm font-semibold text-on-secondary-container"
              >
                {departure.time} ·{' '}
                {realTime && realTime.length > 0
                  ? `${realTime[0].minutes} min (tiempo real 🟢)`
                  : departure.minutesUntil === 0
                    ? 'ahora'
                    : `en ${departure.minutesUntil} min`}
              </span>
            ) : (
              <span
                key={departure.time}
                className="rounded-full bg-surface-container-high px-3 py-1 text-sm font-medium text-on-surface-variant"
              >
                {departure.time}
              </span>
            ),
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-on-surface-variant">
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
      className={`px-4 py-2 text-sm font-semibold transition-colors ${
        isActive
          ? 'border-b-2 border-primary text-primary'
          : 'border-b-2 border-transparent text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {label}
    </button>
  )
}

function NearbyStop({ stop, realTimes, now }) {
  const arrivals = realTimes[stop.codStop]
  const formattedDistance = stop.distance < 1000
    ? `${Math.round(stop.distance)} m`
    : `${(stop.distance / 1000).toFixed(1)} km`

  // Fallback when no real-time data: show the lines that pass through this stop
  const displayedLines = arrivals && arrivals.length > 0 ? arrivals : stop.codLines?.slice(0, 3).map(line => ({
    line,
    destination: 'Destino próximamente',
    minutes: '--',
    isFallback: true
  }))

  return (
    <div className="nv-card space-y-3 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-on-surface">{stop.name}</h3>
          <p className="mt-0.5 text-xs text-on-surface-variant">{formattedDistance}</p>
        </div>
        <div className="flex h-8 min-w-[2rem] flex-none items-center justify-center rounded-lg bg-tertiary-container">
          <MIcon name="location_on" className="text-[16px] text-on-tertiary-container" />
        </div>
      </div>

      {displayedLines && displayedLines.length > 0 ? (
        <div className="space-y-2">
          {displayedLines.slice(0, 3).map((arrival, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-surface-container-high p-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 min-w-[24px] flex-none items-center justify-center rounded bg-primary px-1 text-xs font-bold text-on-primary">
                  {arrival.line}
                </div>
                <div className="flex-1 text-xs text-on-surface-variant">{arrival.destination}</div>
              </div>
              <span className="rounded-full bg-secondary-container px-2 py-0.5 text-xs font-semibold text-on-secondary-container">
                {arrival.isFallback ? 'Cargando' : `en ${arrival.minutes} min`}
              </span>
            </div>
          ))}
          <p className="text-xs text-on-surface-variant">
            {arrivals && arrivals.length > 0 ? 'Próximas llegadas en tiempo real' : 'Líneas que pasan por esta parada'}
          </p>
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant">Cargando próximas llegadas...</p>
      )}
    </div>
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

  // Determine which view to show
  const shouldShowNearbyStops = tab === 'nearby' && !geoError && stops.length > 0
  const showNearbyStopsView = shouldShowNearbyStops
  const showLinesView = !shouldShowNearbyStops

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
          Red de transporte
        </h1>
        <p className="mt-1 text-on-surface-variant">
          Próximas salidas según los horarios oficiales del CRTM.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold text-on-secondary-container">
            Hoy: horario de {DAY_TYPE_LABELS[dayType]}
          </span>
          <span className="rounded-full bg-surface-container-highest px-3 py-1 text-xs font-medium text-on-surface-variant">
            Datos actualizados el {scheduleData.actualizado}
          </span>
        </div>
      </header>

      <div className="border-b border-surface-container-high">
        <div className="flex gap-4">
          <TabButton
            label="Cerca de mí"
            isActive={tab === 'nearby'}
            onClick={() => setTab('nearby')}
          />
          <TabButton
            label="Todas las líneas"
            isActive={tab === 'lines'}
            onClick={() => setTab('lines')}
          />
        </div>
      </div>

      {showNearbyStopsView && (
        <section className="space-y-4">
          {loading ? (
            <div className="nv-card p-5 text-center">
              <p className="text-sm text-on-surface-variant">Buscando paradas cercanas...</p>
            </div>
          ) : stops.length > 0 ? (
            <>
              <div className="space-y-3">
                {stops.map((stop) => (
                  <NearbyStop
                    key={stop.codStop}
                    stop={stop}
                    realTimes={realTimes}
                    now={now}
                  />
                ))}
              </div>
              <section className="nv-card p-5">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-secondary-container p-3">
                    <MIcon name="info" className="text-secondary" fill />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold text-on-surface">
                      Sobre estos datos
                    </h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Horarios oficiales del CRTM con tiempos de llegada en tiempo real cuando disponibles.
                      Puede haber variaciones por tráfico u obras.
                    </p>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="space-y-4">
              <div className="nv-card p-5">
                <p className="text-center text-sm text-on-surface-variant">
                  No hay paradas de autobús en un radio de 600 metros. Consulta todas las líneas abajo.
                </p>
              </div>
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {scheduleData.lineas.map((line) => (
                  <article key={line.numero} className="nv-card space-y-3 p-5 transition-shadow hover:shadow-card-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 min-w-[3.5rem] flex-none items-center justify-center rounded-lg bg-primary px-2 text-on-primary">
                        <span className="font-display text-base font-bold">{line.numero}</span>
                      </div>
                      <h2 className="text-sm font-semibold leading-snug text-on-surface">{line.nombre}</h2>
                    </div>
                    {line.sentidos.map((direction) => (
                      <Direction key={direction.destino} direction={direction} now={now} />
                    ))}
                  </article>
                ))}
              </section>
            </div>
          )}
        </section>
      )}

      {showLinesView && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {scheduleData.lineas.map((line) => (
            <article key={line.numero} className="nv-card space-y-3 p-5 transition-shadow hover:shadow-card-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-11 min-w-[3.5rem] flex-none items-center justify-center rounded-lg bg-primary px-2 text-on-primary">
                  <span className="font-display text-base font-bold">{line.numero}</span>
                </div>
                <h2 className="text-sm font-semibold leading-snug text-on-surface">{line.nombre}</h2>
              </div>
              {line.sentidos.map((direction) => (
                <Direction key={direction.destino} direction={direction} now={now} />
              ))}
            </article>
          ))}
        </section>
      )}

      {!showNearbyStopsView && (
        <section className="nv-card p-5">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-secondary-container p-3">
              <MIcon name="info" className="text-secondary" fill />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-on-surface">
                Sobre estos horarios
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Horarios oficiales publicados por el Consorcio Regional de Transportes de Madrid
                (datos.crtm.es). Las cuentas atrás se calculan con el horario programado; puede
                haber variaciones por tráfico u obras. Actualiza los datos con{' '}
                <code className="rounded bg-surface-container px-1 py-0.5 text-xs">
                  npm run fetch:transporte
                </code>
                .
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
