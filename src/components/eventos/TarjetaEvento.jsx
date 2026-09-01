import { CATEGORIAS_EVENTO, mesDe } from '../../lib/eventos'
import { imagenConTextoRotulado } from '../../lib/dedupEventos'
import { cartelDe } from '../../lib/gaceta'
import { useImagenEvento } from '../../lib/useImagenEvento'
import MIcon from '../MIcon'
import { IconoCategoriaTabler } from './iconosEvento'

/**
 * Tarjeta de evento para el muro de la cartelera (protagonismo del cartel).
 * Cuatro estados según la imagen disponible:
 *  - Cartel real ROTULADO (título/fecha/lugar impresos en el propio JPG, como
 *    los de Instagram del Ayuntamiento o la galería de Deportes): foto limpia
 *    sin velo y texto solo para lectores de pantalla — repetirlo encima lo
 *    hacía ilegible.
 *  - Cartel real SIN rotular: foto + velo + texto, como siempre.
 *  - Ilustrativa de galería (el evento no trae foto; `imagenEvento()` elige
 *    una por categoría, estable por id): foto + velo + texto + plantilla
 *    editorial completa (fecha, organizador) pero SIN el remate de icono, que
 *    se calibró sobre degradado plano y sobre foto es ruido.
 *  - Sin imagen ninguna (pool vacío o url rota): degradado de categoría +
 *    trama + plantilla editorial completa con remate.
 * Props:
 *   - evento
 *   - destacado: ocupa 2 columnas (panorámico) y lleva sello "Destacado"
 *   - onClick
 */
export default function TarjetaEvento({ evento, destacado = false, onClick = () => {} }) {
  // Si la url de la imagen falla al cargar, `posterUrl` pasa a null y toda la
  // plantilla editorial de abajo (fecha, remate de categoría, organizador)
  // vuelve a pintarse — nunca el alt crudo sobre el velo.
  const { posterUrl, pos, onError, real } = useImagenEvento(evento)
  const { fondo, trama } = cartelDe(evento.categoria)
  const cat = CATEGORIAS_EVENTO[evento.categoria]

  // Solo un cartel PROPIO puede llevar el texto rotulado: la condición exige
  // `real` explícitamente para que una ilustrativa de galería jamás dispare
  // este estado aunque el evento venga de una fuente "rotulada" (deportes,
  // Instagram del Ayuntamiento) sin foto propia.
  const textoEnLaImagen = Boolean(posterUrl) && real && imagenConTextoRotulado(evento)
  // Ilustrativa de galería: hay foto pero no es del evento — el texto debe
  // contarlo todo, así que recupera la plantilla editorial (sin el remate).
  const esGenerica = Boolean(posterUrl) && !real
  const conPlantillaEditorial = !posterUrl || esGenerica

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block overflow-hidden rounded-lg text-left shadow-cartel transition-all hover:shadow-lg ${
        destacado ? 'md:col-span-2' : ''
      }`}
      style={{ aspectRatio: destacado ? '16 / 9' : '3 / 4' }}
    >
      {/* Fondo: cartel real, ilustrativa de galería o degradado de categoría */}
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={evento.titulo}
          loading="lazy"
          onError={onError}
          style={{ objectPosition: pos }}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className={`absolute inset-0 ${trama}`} style={{ background: fondo }} />
      )}

      {/* Velo inferior para legibilidad (sin texto superpuesto solo oscurecería el cartel) */}
      {!textoEnLaImagen && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
      )}

      {/* Sello de hora (arriba-izquierda) — visible en todos los estados */}
      {evento.hora && (
        <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 font-mono-ibm text-[11px] tracking-wider text-papel">
          {evento.hora}
        </div>
      )}

      {/* Fecha editorial (arriba-derecha): sin imagen o con ilustrativa — un
          cartel real ya lleva su fecha rotulada o es quien manda visualmente.
          Con sello Destacado se baja para no pisarlo. */}
      {conPlantillaEditorial && evento.fecha && (
        <div
          className={`absolute right-3 flex flex-col items-center ${destacado ? 'top-11' : 'top-3'}`}
        >
          <span className="font-serif-dm text-3xl leading-none text-papel">
            {parseInt(evento.fecha.split('-')[2], 10)}
          </span>
          <span className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-papel/60">
            {mesDe(evento.fecha).slice(0, 3)}
          </span>
        </div>
      )}

      {/* Sello Destacado (arriba-derecha) */}
      {destacado && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-oro px-2 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta">
          <MIcon name="star" className="text-[12px]" />
          Destacado
        </div>
      )}

      {/* Contenido inferior. Con cartel rotulado se oculta solo visualmente
          (sr-only): sigue en el DOM para lectores de pantalla. */}
      <div
        className={
          textoEnLaImagen ? 'sr-only' : 'absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4'
        }
      >
        {/* Remate de categoría: icono pequeño pegado a la etiqueta, como firma
            editorial — no un watermark de fondo (primer hijo del bloque = queda
            debajo del texto que viene después). El porqué está en CLAUDE.md.
            SOLO sin imagen: sobre una foto (incluida la ilustrativa) la
            opacidad 0.10 calibrada para el degradado se pierde o ensucia. */}
        {!posterUrl && (
          <IconoCategoriaTabler
            categoria={evento.categoria}
            subcategoria={evento.subcategoria}
            size={60}
            stroke={1.5}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 text-papel opacity-10"
            style={{ top: '-7px', transform: 'rotate(8deg)' }}
          />
        )}
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

        {/* Organizador: sin imagen o con ilustrativa, y si el evento trae el dato */}
        {conPlantillaEditorial && evento.fuente && (
          <div className="line-clamp-1 font-mono-ibm text-[10px] text-papel/60">
            Organiza · {evento.fuente}
          </div>
        )}
      </div>
    </button>
  )
}
