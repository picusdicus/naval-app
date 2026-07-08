import { Link } from 'react-router-dom'
import { CATEGORIAS_EVENTO, formatearFechaCorta } from '../../lib/eventos.js'
import { IconoEvento } from './iconosEvento.jsx'
import { imagenEvento } from '../../lib/imagenesEvento.js'
import MIcon from '../MIcon.jsx'

const ORIGEN = {
  municipal: 'Municipal',
  cultural: 'Cultura',
  vecinal: 'Vecinal',
}

function horaTexto(e) {
  if (!e.hora) return ''
  return e.horaFin ? `${e.hora} – ${e.horaFin}` : e.hora
}

// Fila de evento en la lista de la agenda. Con `pasado` se muestra atenuada y
// con una etiqueta "Finalizado", para distinguir el histórico de lo próximo.
// Al pulsarla se navega a la página de detalle (/eventos/:id) dentro de la app.
export default function EventoFila({ evento: e, pasado = false }) {
  return (
    <Link
      to={`/eventos/${e.id}`}
      className={`nv-card flex gap-4 p-4 transition-shadow hover:shadow-card-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        pasado ? 'opacity-75 grayscale-[35%] hover:opacity-100' : ''
      }`}
    >
      <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary-container to-primary text-on-primary-container sm:h-32 sm:w-32">
        {imagenEvento(e) ? (
          <img
            src={imagenEvento(e).src}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: imagenEvento(e).pos || '50% 50%' }}
          />
        ) : (
          <IconoEvento categoria={e.categoria} className="text-[36px]" />
        )}
      </div>
      <div className="flex flex-grow flex-col justify-between">
        <div>
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-secondary">
              {CATEGORIAS_EVENTO[e.categoria]?.nombre || 'Evento'} · {ORIGEN[e.origen] || 'Vecinal'}
            </span>
            <span className="flex items-center gap-2">
              {pasado && (
                <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  Finalizado
                </span>
              )}
              <span className="text-xs text-on-surface-variant">{formatearFechaCorta(e.fecha)}</span>
            </span>
          </div>
          <h4 className="mb-2 font-display text-base font-semibold text-on-surface">{e.titulo}</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surface-variant">
            {horaTexto(e) && (
              <div className="flex items-center gap-1">
                <MIcon name="schedule" className="text-[16px]" />
                <span>{horaTexto(e)}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <MIcon name="location_on" className="text-[16px]" />
              <span>{e.lugar}</span>
            </div>
          </div>
          {e.descripcion && (
            <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">{e.descripcion}</p>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <span className="flex items-center gap-1 text-sm font-semibold text-primary">
            Ver detalles <MIcon name="chevron_right" className="text-[18px]" />
          </span>
        </div>
      </div>
    </Link>
  )
}
