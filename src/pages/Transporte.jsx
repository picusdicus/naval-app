import lineas from '../data/transporte.json'
import MIcon from '../components/MIcon.jsx'

export default function Transporte() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
          Red de transporte
        </h1>
        <p className="mt-1 text-on-surface-variant">
          Líneas de autobús interurbano hacia Madrid y municipios cercanos. Horarios orientativos.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        {lineas.map((l) => (
          <article key={l.numero} className="nv-card flex gap-4 p-5 transition-shadow hover:shadow-card-lg">
            <div className="flex h-12 w-16 flex-none items-center justify-center rounded-lg bg-primary text-on-primary">
              <span className="font-display text-base font-bold">{l.numero}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-semibold text-on-surface">{l.ruta}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">{l.frecuencia}</p>
              <div className="mt-2 flex gap-4 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <MIcon name="schedule" className="text-[14px]" /> Primero: {l.primero}
                </span>
                <span className="flex items-center gap-1">
                  <MIcon name="bedtime" className="text-[14px]" /> Último: {l.ultimo}
                </span>
              </div>
            </div>
            <MIcon name="directions_bus" className="flex-none self-center text-[28px] text-secondary" />
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
              Estado del servicio
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Todas las líneas operan con normalidad. Próximamente: horarios en tiempo real y
              avisos de retrasos del CRTM.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
