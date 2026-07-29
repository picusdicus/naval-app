import { CATEGORIAS_EVENTO } from '../../lib/eventos'
import { cartelDe } from '../../lib/gaceta'
import { imagenEvento } from '../../lib/imagenesEvento'
import MIcon from '../MIcon'

/**
 * Tarjeta de evento para el muro de la cartelera (protagonismo del cartel).
 * El cartel real (si existe) va a sangre; sin él, degradado de categoría +
 * trama + título en serif grande — nunca un hueco vacío.
 * Props:
 *   - evento
 *   - destacado: ocupa 2 columnas (panorámico) y lleva sello "Destacado"
 *   - onClick
 */
export default function TarjetaEvento({ evento, destacado = false, onClick = () => {} }) {
  // Cartel real (imagen del evento) o, en su defecto, la foto temática por
  // categoría; solo si no hay ninguna, el degradado. (Antes solo se usaba el
  // cartel real y por eso desaparecían las fotos genéricas de los curados.)
  const img = imagenEvento(evento)
  const posterUrl = img?.src ?? null
  const { fondo, trama } = cartelDe(evento.categoria)
  const cat = CATEGORIAS_EVENTO[evento.categoria]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block overflow-hidden rounded-lg text-left shadow-cartel transition-all hover:shadow-lg ${
        destacado ? 'md:col-span-2' : ''
      }`}
      style={{ aspectRatio: destacado ? '16 / 9' : '3 / 4' }}
    >
      {/* Fondo: cartel real o degradado de categoría con trama */}
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={evento.titulo}
          loading="lazy"
          style={{ objectPosition: img?.pos || '50% 50%' }}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className={`absolute inset-0 ${trama}`} style={{ background: fondo }} />
      )}

      {/* Velo inferior para legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

      {/* Sello de hora (arriba-izquierda) */}
      {evento.hora && (
        <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 font-mono-ibm text-[11px] tracking-wider text-papel">
          {evento.hora}
        </div>
      )}

      {/* Sello Destacado (arriba-derecha) */}
      {destacado && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-oro px-2 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta">
          <MIcon name="star" className="text-[12px]" />
          Destacado
        </div>
      )}

      {/* Contenido inferior */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
        <div className="inline-flex w-fit items-center gap-2">
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: cat?.color }}
          />
          <span className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-oro">
            {cat?.nombre}
          </span>
        </div>

        <h3 className="line-clamp-2 font-serif-dm text-lg italic leading-tight text-papel md:text-xl">
          {evento.titulo}
        </h3>

        <div className="flex items-start gap-1 text-xs text-papel/80">
          <MIcon name="location_on" className="mt-0.5 flex-shrink-0 text-[13px]" />
          <span className="line-clamp-1">{evento.lugar}</span>
        </div>
      </div>
    </button>
  )
}
