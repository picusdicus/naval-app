import { Link } from 'react-router-dom'
import { CATEGORIAS_EVENTO, formatearFechaCorta } from '../../lib/eventos.js'
import { IconoEvento } from './iconosEvento.jsx'
import { imagenEvento } from '../../lib/imagenesEvento.js'
import { cartelDe } from '../../lib/gaceta.js'
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

// Fila de evento en la agenda (La Gaceta): thumb cuadrado con trama de cartel,
// eyebrow mono con categoría·hora y título en DM Serif. Con `pasado` se atenúa
// y muestra "Finalizado". Al pulsarla navega a /eventos/:id.
export default function EventoFila({ evento: e, pasado = false }) {
  const img = imagenEvento(e)
  const cartel = cartelDe(e.categoria)

  return (
    <Link
      to={`/eventos/${e.id}`}
      className={`flex gap-4 border-b border-filete pb-4 transition-opacity ${
        pasado ? 'opacity-60 grayscale-[35%] hover:opacity-100' : ''
      }`}
    >
      <div
        className={`relative h-20 w-20 flex-shrink-0 overflow-hidden ${img ? '' : cartel.trama}`}
        style={img ? undefined : { background: cartel.fondo }}
      >
        {img ? (
          <img
            src={img.src}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: img.pos || '50% 50%' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-25">
            <IconoEvento categoria={e.categoria} className="text-[32px] text-white" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="gz-eyebrow truncate">
            {CATEGORIAS_EVENTO[e.categoria]?.nombre || 'Evento'}
            {horaTexto(e) ? ` · ${horaTexto(e)}` : ''}
          </span>
          <span className="flex flex-shrink-0 items-center gap-2">
            {pasado && <span className="gz-label text-mudo">Finalizado</span>}
            <span className="font-mono-ibm text-[10px] text-pardo">{formatearFechaCorta(e.fecha)}</span>
          </span>
        </div>
        <h4 className="mt-1 font-serif-dm text-xl leading-tight text-tinta">{e.titulo}</h4>
        <div className="mt-1 flex items-center gap-1 font-serif-spectral text-[13px] text-pardo">
          <MIcon name="location_on" className="text-[15px]" />
          <span className="truncate">{e.lugar}</span>
        </div>
      </div>
    </Link>
  )
}
