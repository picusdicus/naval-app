import { Link } from 'react-router-dom'
import { IconCalendar, IconMap, IconNews, IconBus, IconBuilding, IconPaw } from '../components/icons.jsx'
import eventosCurados from '../data/eventos.json'
import eventosExternos from '../data/eventos-externos.json'
import { proximosEventos, formatearFechaCorta } from '../lib/eventos.js'
import { IconoEvento } from '../components/eventos/iconosEvento.jsx'

const accesos = [
  { to: '/eventos', label: 'Eventos', Icon: IconCalendar },
  { to: '/mapa', label: 'Directorio', Icon: IconMap },
  { to: '/noticias', label: 'Noticias', Icon: IconNews },
  { to: '/transporte', label: 'Bus', Icon: IconBus },
]

const eventosDestacados = proximosEventos([...eventosCurados, ...eventosExternos], 4)

const avisos = [
  {
    titulo: 'Corte de agua en el barrio de la Estación',
    fuente: 'Ayuntamiento',
    cuando: 'hace 2 h',
    Icon: IconBuilding,
  },
  {
    titulo: 'Se busca: perdida gata atigrada zona El Soto',
    fuente: 'Vecino',
    cuando: 'hace 5 h',
    Icon: IconPaw,
  },
]

export default function Inicio() {
  return (
    <div className="space-y-8">
      <section className="-mx-4 rounded-b-2xl bg-vino px-4 py-6 text-crema md:mx-0 md:rounded-2xl md:px-8">
        <p className="font-display text-lg text-crema/90">Buenas tardes, vecino</p>
        <p className="mt-1 text-sm text-crema/60">Domingo, 7 de julio · 31°C soleado</p>
      </section>

      <section>
        <div className="grid grid-cols-4 gap-3">
          {accesos.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex flex-col items-center gap-2 rounded-xl p-2 text-center hover:bg-white/60"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-tierra text-crema">
                <a.Icon className="h-5 w-5" />
              </span>
              <span className="text-xs text-tinta">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-vino">Próximos eventos</h2>
          <Link to="/eventos" className="text-xs font-medium text-tierra-dark">
            Ver todos
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {eventosDestacados.map((e) => (
            <Link
              to="/eventos"
              key={e.id}
              className="w-48 flex-none overflow-hidden rounded-2xl border border-tierra/10 bg-white"
            >
              <div className="flex h-16 items-center justify-center bg-gradient-to-t from-tierra-dark to-tierra text-crema">
                <IconoEvento categoria={e.categoria} className="h-6 w-6" />
              </div>
              <div className="p-3">
                <p className="text-[11px] font-semibold uppercase text-dorado-dark">
                  {formatearFechaCorta(e.fecha)} · {e.origen}
                </p>
                <p className="mt-1 text-sm font-medium text-tinta">{e.titulo}</p>
                <p className="mt-1 text-xs text-tinta-muted">{e.lugar}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-vino">Noticias</h2>
          <Link to="/noticias" className="text-xs font-medium text-tierra-dark">
            Tablón vecinal
          </Link>
        </div>
        <div className="space-y-2">
          {avisos.map((n) => (
            <div
              key={n.titulo}
              className="flex items-start gap-3 rounded-xl border border-tierra/10 bg-white p-3"
            >
              <n.Icon className="mt-0.5 h-4 w-4 flex-none text-tierra" />
              <div>
                <p className="text-sm font-medium text-tinta">{n.titulo}</p>
                <p className="mt-1 text-xs text-tinta-muted">
                  {n.fuente} · {n.cuando}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
