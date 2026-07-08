import { useEffect, useState } from 'react'
import horariosBus from '../data/horarios-bus.json'
import {
  tipoDeDia,
  ETIQUETA_TIPO_DIA,
  proximasSalidas,
  primeraSalidaManana,
} from '../lib/horariosBus.js'
import { useTiempoReal } from '../hooks/useTiempoReal.js'
import { useParadasCercanas } from '../hooks/useParadasCercanas.js'
import MIcon from '../components/MIcon.jsx'

function Sentido({ sentido, ahora }) {
  const proximas = proximasSalidas(sentido.horarios, ahora, 3)
  const manana = primeraSalidaManana(sentido.horarios, ahora)
  const tiempoReal = useTiempoReal(sentido.codParada)

  return (
    <div className="border-t border-surface-container-high pt-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
        <MIcon name="arrow_forward" className="text-[16px] text-secondary" />
        {sentido.destino}
      </p>
      <p className="mt-0.5 text-xs text-on-surface-variant">Desde {sentido.parada}</p>
      {proximas.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {proximas.map((s, i) =>
            i === 0 ? (
              <span
                key={s.hora}
                className="rounded-full bg-secondary-container px-3 py-1 text-sm font-semibold text-on-secondary-container"
              >
                {s.hora} ·{' '}
                {tiempoReal && tiempoReal.length > 0
                  ? `${tiempoReal[0]} min (tiempo real 🟢)`
                  : s.enMin === 0
                    ? 'ahora'
                    : `en ${s.enMin} min`}
              </span>
            ) : (
              <span
                key={s.hora}
                className="rounded-full bg-surface-container-high px-3 py-1 text-sm font-medium text-on-surface-variant"
              >
                {s.hora}
              </span>
            ),
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-on-surface-variant">
          No quedan salidas hoy{manana ? ` · mañana a las ${manana}` : ''}
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

function ParadaCercana({ parada, tiemposReales, ahora }) {
  const minutos = tiemposReales[parada.codStop]
  const distanciaFormato = parada.distancia < 1000
    ? `${Math.round(parada.distancia)} m`
    : `${(parada.distancia / 1000).toFixed(1)} km`

  return (
    <div className="nv-card space-y-3 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-on-surface">{parada.name}</h3>
          <p className="mt-0.5 text-xs text-on-surface-variant">{distanciaFormato}</p>
        </div>
        <div className="flex h-8 min-w-[2rem] flex-none items-center justify-center rounded-lg bg-tertiary-container">
          <MIcon name="location_on" className="text-[16px] text-on-tertiary-container" />
        </div>
      </div>

      {minutos && minutos.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {minutos.slice(0, 3).map((m, i) => (
              <span
                key={i}
                className="rounded-full bg-secondary-container px-3 py-1 text-sm font-semibold text-on-secondary-container"
              >
                en {m} min
              </span>
            ))}
          </div>
          <p className="text-xs text-on-surface-variant">Próximas llegadas en tiempo real</p>
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant">Cargando próximas llegadas...</p>
      )}
    </div>
  )
}

export default function Transporte() {
  const [ahora, setAhora] = useState(() => new Date())
  const [tab, setTab] = useState('cercanas')
  const { paradas, tiemposReales, cargando, geoError } = useParadasCercanas()

  // Si hay error de geolocalización, cambiar a la pestaña de líneas
  useEffect(() => {
    if (geoError && !cargando && tab === 'cercanas') {
      setTab('lineas')
    }
  }, [geoError, cargando, tab])

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const tipo = tipoDeDia(ahora)

  // Determinar qué vista mostrar
  const debeAceptarGeo = tab === 'cercanas' && !geoError && paradas.length > 0
  const mostrarVistaCercanas = debeAceptarGeo
  const mostrarVistaLineas = !debeAceptarGeo

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
            Hoy: horario de {ETIQUETA_TIPO_DIA[tipo]}
          </span>
          <span className="rounded-full bg-surface-container-highest px-3 py-1 text-xs font-medium text-on-surface-variant">
            Datos actualizados el {horariosBus.actualizado}
          </span>
        </div>
      </header>

      <div className="border-b border-surface-container-high">
        <div className="flex gap-4">
          <TabButton
            label="Cerca de mí"
            isActive={tab === 'cercanas'}
            onClick={() => setTab('cercanas')}
          />
          <TabButton
            label="Todas las líneas"
            isActive={tab === 'lineas'}
            onClick={() => setTab('lineas')}
          />
        </div>
      </div>

      {mostrarVistaCercanas && (
        <section className="space-y-4">
          {cargando ? (
            <div className="nv-card p-5 text-center">
              <p className="text-sm text-on-surface-variant">Buscando paradas cercanas...</p>
            </div>
          ) : paradas.length > 0 ? (
            <>
              <div className="space-y-3">
                {paradas.map((parada) => (
                  <ParadaCercana
                    key={parada.codStop}
                    parada={parada}
                    tiemposReales={tiemposReales}
                    ahora={ahora}
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
                {horariosBus.lineas.map((l) => (
                  <article key={l.numero} className="nv-card space-y-3 p-5 transition-shadow hover:shadow-card-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 min-w-[3.5rem] flex-none items-center justify-center rounded-lg bg-primary px-2 text-on-primary">
                        <span className="font-display text-base font-bold">{l.numero}</span>
                      </div>
                      <h2 className="text-sm font-semibold leading-snug text-on-surface">{l.nombre}</h2>
                    </div>
                    {l.sentidos.map((s) => (
                      <Sentido key={s.destino} sentido={s} ahora={ahora} />
                    ))}
                  </article>
                ))}
              </section>
            </div>
          )}
        </section>
      )}

      {mostrarVistaLineas && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {horariosBus.lineas.map((l) => (
            <article key={l.numero} className="nv-card space-y-3 p-5 transition-shadow hover:shadow-card-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-11 min-w-[3.5rem] flex-none items-center justify-center rounded-lg bg-primary px-2 text-on-primary">
                  <span className="font-display text-base font-bold">{l.numero}</span>
                </div>
                <h2 className="text-sm font-semibold leading-snug text-on-surface">{l.nombre}</h2>
              </div>
              {l.sentidos.map((s) => (
                <Sentido key={s.destino} sentido={s} ahora={ahora} />
              ))}
            </article>
          ))}
        </section>
      )}

      {!mostrarVistaCercanas && (
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
