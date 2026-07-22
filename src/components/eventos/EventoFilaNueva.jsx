import { Link } from 'react-router-dom'
import { CATEGORIAS_EVENTO, formatearFechaCorta } from '../../lib/eventos.js'
import { imagenEvento } from '../../lib/imagenesEvento.js'
import { cartelDe } from '../../lib/gaceta.js'
import MIcon from '../MIcon.jsx'
import { IconoEvento } from './iconosEvento.jsx'

function horaTexto(e) {
  if (!e.hora) return ''
  return e.horaFin ? `${e.hora} – ${e.horaFin}` : e.hora
}

function diaNumero(fecha) {
  return new Date(`${fecha}T00:00:00`).getDate()
}

export default function EventoFilaNueva({ evento: e, pasado = false }) {
  const img = imagenEvento(e)
  const cartel = cartelDe(e.categoria)
  const cat = CATEGORIAS_EVENTO[e.categoria]
  const dia = diaNumero(e.fecha)

  return (
    <Link
      to={`/eventos/${e.id}`}
      className={`flex gap-4 border-b border-filete pb-4 transition-opacity ${
        pasado ? 'opacity-60 grayscale-[35%] hover:opacity-100' : ''
      }`}
    >
      {/* Número de día grande */}
      <div className="flex flex-col items-center justify-start flex-shrink-0">
        <span className="font-serif-dm text-4xl leading-none font-bold text-terracota">
          {String(dia).padStart(2, '0')}
        </span>
      </div>

      {/* Imagen cuadrada */}
      <div
        className={`relative h-24 w-24 flex-shrink-0 overflow-hidden ${img ? '' : cartel.trama}`}
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

      {/* Contenido */}
      <div className="min-w-0 flex-1">
        {/* Categoría y hora */}
        <div className="flex items-baseline gap-1.5">
          <span className="gz-eyebrow">
            {cat?.nombre || 'Evento'}
            {horaTexto(e) ? ` · ${horaTexto(e)}` : ''}
          </span>
        </div>

        {/* Título */}
        <h4 className="mt-1 font-serif-dm text-lg leading-tight text-tinta">{e.titulo}</h4>

        {/* Lugar */}
        <div className="mt-1.5 flex items-center gap-1 font-serif-spectral text-[13px] text-pardo">
          <MIcon name="location_on" className="text-[15px]" />
          <span className="truncate">{e.lugar}</span>
        </div>

        {/* Botones */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            className="px-4 py-1.5 border border-tinta text-tinta hover:bg-papel-calido transition-colors font-mono-ibm text-[10px] font-bold uppercase tracking-etiqueta"
          >
            Ver ficha
          </button>
          {!pasado && (
            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              className="px-4 py-1.5 border border-tinta text-tinta hover:bg-papel-calido transition-colors font-mono-ibm text-[10px] font-bold uppercase tracking-etiqueta"
            >
              Reservar
            </button>
          )}
        </div>
      </div>
    </Link>
  )
}
