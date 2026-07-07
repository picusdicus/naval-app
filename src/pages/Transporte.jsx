import { IconBus } from '../components/icons.jsx'
import lineas from '../data/transporte.json'

export default function Transporte() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-vino">Transporte</h1>
        <p className="mt-1 text-sm text-tinta-muted">
          Líneas de autobús interurbano hacia Madrid y municipios cercanos. Horarios orientativos.
        </p>
      </header>

      <div className="space-y-3">
        {lineas.map((l) => (
          <article
            key={l.numero}
            className="flex gap-4 rounded-2xl border border-tierra/10 bg-white p-4"
          >
            <div className="flex h-12 w-14 flex-none items-center justify-center rounded-xl bg-vino text-crema">
              <span className="font-display text-sm font-semibold">{l.numero}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-tinta">{l.ruta}</h2>
              <p className="mt-1 text-sm text-tinta-muted">{l.frecuencia}</p>
              <div className="mt-2 flex gap-4 text-xs text-tinta-muted">
                <span>Primero: {l.primero}</span>
                <span>Último: {l.ultimo}</span>
              </div>
            </div>
            <IconBus className="h-6 w-6 flex-none self-center text-tierra" />
          </article>
        ))}
      </div>

      <p className="rounded-xl bg-dorado/10 p-3 text-xs text-tinta-muted">
        Próximamente: horarios en tiempo real y avisos de retrasos.
      </p>
    </div>
  )
}
