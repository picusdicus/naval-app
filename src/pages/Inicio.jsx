import { Link } from 'react-router-dom'
import eventosCurados from '../data/eventos.json'
import eventosExternos from '../data/eventos-externos.json'
import {
  proximosEventos,
  formatearFechaCorta,
  CATEGORIAS_EVENTO,
} from '../lib/eventos.js'
import { IconoEvento } from '../components/eventos/iconosEvento.jsx'
import {
  IconSun,
  IconHealthCross,
  IconAlert,
  IconArrowRight,
  IconDroplet,
} from '../components/icons.jsx'

const proximos = proximosEventos([...eventosCurados, ...eventosExternos])
const destacado = proximos[0]
const siguientes = proximos.slice(1, 4)

const ORIGEN_CHIP = {
  municipal: 'bg-vino/10 text-vino',
  cultural: 'bg-oro/15 text-oro-dark',
  vecinal: 'bg-azul-tint text-azul',
}

function EventoFila({ e }) {
  const chip = ORIGEN_CHIP[e.origen] || ORIGEN_CHIP.vecinal
  return (
    <Link to="/eventos" className="nv-card flex items-center gap-3 p-3">
      <div className="w-12 flex-none text-center">
        <div className="font-display text-lg font-semibold leading-none text-vino">
          {formatearFechaCorta(e.fecha).split(' ')[0]}
        </div>
        <div className="text-[10px] uppercase text-tinta-muted">
          {formatearFechaCorta(e.fecha).split(' ')[1]}
        </div>
      </div>
      <div className="h-9 w-px flex-none bg-crema-dark" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-tinta">{e.titulo}</p>
        <p className="truncate text-xs text-tinta-muted">
          {e.hora ? `${e.hora} · ` : ''}
          {e.lugar}
        </p>
      </div>
      <span className={`nv-chip ${chip}`}>
        {e.origen === 'municipal' ? 'Municipal' : e.origen === 'cultural' ? 'Cultura' : 'Vecinal'}
      </span>
    </Link>
  )
}

export default function Inicio() {
  return (
    <div className="space-y-5">
      {/* Hero: saludo + tiempo */}
      <section className="-mx-4 -mt-4 bg-gradient-to-b from-vino to-vino-dark px-5 pb-6 pt-5 text-crema">
        <h1 className="font-display text-2xl font-medium text-white">Buenas tardes, vecino</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-crema/70">
          <IconSun className="h-4 w-4 text-oro" />
          Martes, 7 de julio · 31° soleado
        </p>
      </section>

      {/* Accesos rápidos */}
      <section className="flex gap-2.5">
        <Link
          to="/mapa"
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-2.5 text-xs font-medium text-vino shadow-soft"
        >
          <IconHealthCross className="h-4 w-4" />
          Farmacia de guardia
        </Link>
        <Link
          to="/noticias"
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-2.5 text-xs font-medium text-vino shadow-soft"
        >
          <IconAlert className="h-4 w-4" />
          Avisos
        </Link>
      </section>

      {/* Evento destacado */}
      {destacado && (
        <section>
          <Link to="/eventos" className="nv-card block overflow-hidden">
            <div className="relative flex h-32 items-end bg-gradient-to-br from-vino-light to-vino-dark">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(120% 90% at 80% 10%, rgba(199,154,58,0.35), transparent 55%)',
                }}
              />
              <span className="nv-chip absolute left-3 top-3 bg-crema/90 font-semibold text-vino-dark">
                {(CATEGORIAS_EVENTO[destacado.categoria]?.nombre || 'Evento').toUpperCase()}
              </span>
              <div className="relative flex items-center gap-2 p-3.5 text-oro">
                <IconoEvento categoria={destacado.categoria} className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  {formatearFechaCorta(destacado.fecha)}
                  {destacado.hora ? ` · ${destacado.hora}` : ''} · {destacado.lugar}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h2 className="font-display text-lg font-semibold leading-tight text-tinta">
                {destacado.titulo}
              </h2>
              <p className="mt-1.5 text-sm text-tinta-muted">{destacado.descripcion}</p>
              <span className="mt-3 flex items-center gap-1.5 text-sm font-medium text-vino">
                Ver detalles <IconArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        </section>
      )}

      {/* Tiempo + basura */}
      <section className="flex gap-3">
        <div className="nv-card flex-1 p-4">
          <p className="text-[11px] uppercase tracking-wide text-tinta-muted">Tiempo hoy</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-display text-3xl font-semibold text-tinta">31°</span>
            <IconSun className="h-5 w-5 text-oro" />
          </div>
          <p className="mt-0.5 text-[11px] text-tinta-muted">Despejado · máx 33°</p>
        </div>
        <div className="nv-card flex-1 p-4">
          <p className="text-[11px] uppercase tracking-wide text-tinta-muted">Recogida basura</p>
          <p className="mt-1.5 font-display text-lg font-semibold text-tinta">Mañana</p>
          <p className="mt-0.5 text-[11px] text-tinta-muted">Orgánica · 07:00</p>
        </div>
      </section>

      {/* Próximos eventos */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="nv-section-title">Próximos eventos</h2>
          <Link to="/eventos" className="text-xs font-medium text-oro-dark">
            Ver todos
          </Link>
        </div>
        <div className="space-y-2.5">
          {siguientes.map((e) => (
            <EventoFila key={e.id} e={e} />
          ))}
        </div>
      </section>

      {/* Aviso */}
      <section>
        <div
          className="nv-card flex items-start gap-3 p-3.5"
          style={{ borderLeft: '4px solid #C79A3A', borderRadius: '14px 20px 20px 14px' }}
        >
          <IconDroplet className="mt-0.5 h-5 w-5 flex-none text-vino" />
          <div>
            <p className="text-sm font-medium text-tinta">Corte de agua programado</p>
            <p className="mt-0.5 text-xs text-tinta-muted">
              Martes 8:00–14:00 · barrio de la Estación.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
