import MIcon from '../components/MIcon.jsx'

const oficiales = [
  {
    titulo: 'Corte de agua en el barrio de la Estación',
    resumen: 'El próximo martes de 9:00 a 13:00 por trabajos de mantenimiento en la red.',
    cuando: 'hace 2 horas',
    icono: 'water_drop',
  },
  {
    titulo: 'Nuevo horario de la biblioteca municipal',
    resumen: 'A partir de septiembre abrirá también los sábados por la mañana.',
    cuando: 'ayer',
    icono: 'local_library',
  },
]

const tablon = [
  {
    titulo: 'Se busca: perdida gata atigrada zona El Soto',
    autor: 'María G.',
    cuando: 'hace 5 horas',
    icono: 'pets',
  },
  {
    titulo: 'Vendo bicicleta infantil, buen estado',
    autor: 'Javier R.',
    cuando: 'hace 1 día',
    icono: 'pedal_bike',
  },
]

export default function Noticias() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
          Muro de noticias
        </h1>
        <p className="mt-1 text-on-surface-variant">
          Mantente al día de los últimos acontecimientos y avisos importantes del pueblo.
        </p>
      </header>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <MIcon name="account_balance" className="text-primary" />
          <h2 className="nv-section-title">Noticias oficiales</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {oficiales.map((n) => (
            <article key={n.titulo} className="nv-card p-5 transition-shadow hover:shadow-card-lg">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary-container p-3 text-on-primary-container">
                  <MIcon name={n.icono} />
                </div>
                <div>
                  <p className="font-display text-base font-semibold text-on-surface">{n.titulo}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{n.resumen}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-secondary">
                    Ayuntamiento · {n.cuando}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MIcon name="forum" className="text-primary" />
            <h2 className="nv-section-title">Tablón vecinal</h2>
          </div>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-all hover:bg-primary-container active:scale-95"
          >
            Publicar aviso
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {tablon.map((n) => (
            <div key={n.titulo} className="nv-card flex items-start gap-4 p-4">
              <div className="rounded-full bg-secondary-container p-2.5 text-on-secondary-container">
                <MIcon name={n.icono} className="text-[20px]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">{n.titulo}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {n.autor} · {n.cuando}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-on-surface-variant">
          La publicación abierta de avisos estará disponible próximamente.
        </p>
      </section>
    </div>
  )
}
