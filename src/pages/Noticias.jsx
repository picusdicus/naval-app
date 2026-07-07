import { IconBuilding, IconPaw, IconBasket } from '../components/icons.jsx'

const oficiales = [
  {
    titulo: 'Corte de agua en el barrio de la Estación',
    resumen: 'El próximo martes de 9:00 a 13:00 por trabajos de mantenimiento en la red.',
    cuando: 'hace 2 horas',
  },
  {
    titulo: 'Nuevo horario de la biblioteca municipal',
    resumen: 'A partir de septiembre abrirá también los sábados por la mañana.',
    cuando: 'ayer',
  },
]

const tablon = [
  {
    titulo: 'Se busca: perdida gata atigrada zona El Soto',
    autor: 'María G.',
    cuando: 'hace 5 horas',
    Icon: IconPaw,
  },
  {
    titulo: 'Vendo bicicleta infantil, buen estado',
    autor: 'Javier R.',
    cuando: 'hace 1 día',
    Icon: IconBasket,
  },
]

export default function Noticias() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold text-vino">Noticias</h1>
        <p className="mt-1 text-sm text-tinta-muted">
          Información oficial del ayuntamiento y avisos publicados por los propios vecinos.
        </p>
      </header>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <IconBuilding className="h-5 w-5 text-tierra" />
          <h2 className="font-display text-lg font-semibold text-vino">Noticias oficiales</h2>
        </div>
        <div className="space-y-2">
          {oficiales.map((n) => (
            <article key={n.titulo} className="rounded-2xl border border-tierra/10 bg-white p-4">
              <p className="font-medium text-tinta">{n.titulo}</p>
              <p className="mt-1 text-sm text-tinta-muted">{n.resumen}</p>
              <p className="mt-2 text-xs text-tinta-muted">Ayuntamiento · {n.cuando}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-vino">Tablón vecinal</h2>
          <button
            type="button"
            className="rounded-full bg-tierra px-3 py-1.5 text-xs font-medium text-crema"
          >
            Publicar aviso
          </button>
        </div>
        <div className="space-y-2">
          {tablon.map((n) => (
            <div
              key={n.titulo}
              className="flex items-start gap-3 rounded-xl border border-tierra/10 bg-white p-3"
            >
              <n.Icon className="mt-0.5 h-4 w-4 flex-none text-tierra" />
              <div>
                <p className="text-sm font-medium text-tinta">{n.titulo}</p>
                <p className="mt-1 text-xs text-tinta-muted">
                  {n.autor} · {n.cuando}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-tinta-muted">
          La publicación abierta de avisos estará disponible próximamente.
        </p>
      </section>
    </div>
  )
}
