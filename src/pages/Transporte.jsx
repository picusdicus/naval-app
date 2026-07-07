import { useEffect, useState } from 'react'
import horariosBus from '../data/horarios-bus.json'
import {
  tipoDeDia,
  ETIQUETA_TIPO_DIA,
  proximasSalidas,
  primeraSalidaManana,
} from '../lib/horariosBus.js'
import MIcon from '../components/MIcon.jsx'

function Sentido({ sentido, ahora }) {
  const proximas = proximasSalidas(sentido.horarios, ahora, 3)
  const manana = primeraSalidaManana(sentido.horarios, ahora)

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
                {s.hora} · {s.enMin === 0 ? 'ahora' : `en ${s.enMin} min`}
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

export default function Transporte() {
  // Reloj vivo: recalcula las cuentas atrás cada 30 segundos.
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const tipo = tipoDeDia(ahora)

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
    </div>
  )
}
