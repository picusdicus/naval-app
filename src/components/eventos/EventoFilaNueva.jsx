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

export default function EventoFilaNueva({ evento: e, pasado = false }) {
  const img = imagenEvento(e)
  const cartel = cartelDe(e.categoria)
  const cat = CATEGORIAS_EVENTO[e.categoria]
  const hora = horaTexto(e)

  return (
    <Link
      to={`/eventos/${e.id}`}
      className={`flex flex-col rounded-lg border-2 border-tinta overflow-hidden bg-papel transition-transform hover:shadow-lg group ${
        pasado ? 'opacity-60 grayscale-[35%] hover:opacity-100' : ''
      }`}
    >
      {/* Imagen prominente */}
      <div
        className={`relative h-48 w-full overflow-hidden ${img ? '' : cartel.trama}`}
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
            <IconoEvento categoria={e.categoria} className="text-[56px] text-white" />
          </div>
        )}

        {/* Gradiente oscuro para el texto inferior */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Badge de categoría y hora - superpuesto sobre la imagen */}
        <div className="absolute top-0 left-0 flex items-center gap-2">
          <span className="bg-terracota px-2 py-1 font-mono-ibm text-[9px] font-bold uppercase tracking-etiqueta text-papel">
            • {cat?.nombre || 'Evento'}
          </span>
          {hora && (
            <span className="bg-tinta/80 px-2 py-1 font-mono-ibm text-[9px] font-bold uppercase tracking-etiqueta text-papel">
              {hora}
            </span>
          )}
        </div>

        {/* Título y lugar en la parte inferior de la imagen */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col gap-1">
          <h3 className="font-serif-dm text-xl font-bold leading-tight text-white">
            {e.titulo}
          </h3>
          <div className="flex items-center gap-1 font-serif-spectral text-[13px] text-white/90">
            <MIcon name="location_on" className="text-[16px]" />
            <span className="truncate">{e.lugar}</span>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2 p-3 border-t border-filete bg-papel-calido">
        <button
          type="button"
          onClick={(ev) => ev.preventDefault()}
          className="flex-1 px-3 py-1.5 border border-tinta text-tinta hover:bg-papel transition-colors font-mono-ibm text-[10px] font-bold uppercase tracking-etiqueta"
        >
          Ver ficha
        </button>
        {!pasado && (
          <button
            type="button"
            onClick={(ev) => ev.preventDefault()}
            className="flex-1 px-3 py-1.5 border border-tinta text-tinta hover:bg-papel transition-colors font-mono-ibm text-[10px] font-bold uppercase tracking-etiqueta"
          >
            Cómo llegar
          </button>
        )}
      </div>
    </Link>
  )
}
