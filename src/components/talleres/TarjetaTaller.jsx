import { cartelDe } from '../../lib/gaceta'
import { useImagenEvento } from '../../lib/useImagenEvento'
import { colorCategoriaTaller, nombreCategoriaTaller, tallerComoEvento, textoTurno } from '../../lib/talleres'
import MIcon from '../MIcon'

/**
 * Tarjeta de un taller para el listado de /talleres.
 *
 * Mismo lenguaje visual que TarjetaEvento (proporción 3/4, foto a sangre o
 * degradado + trama, velo inferior, título serif en cursiva): un vecino debe
 * reconocer el sistema al pasar de la cartelera a los talleres. Lo que cambia
 * es la plantilla editorial, porque los datos son otros:
 *
 *  - donde el evento pone la FECHA (día grande + mes), el taller pone su
 *    número de TURNOS: "3 turnos" es lo que de verdad distingue un taller de
 *    otro en el listado, y una fecha no existe;
 *  - la línea de metadatos lleva el primer turno y el lugar;
 *  - el precio va en un sello arriba-izquierda, el hueco donde el evento pone
 *    la hora.
 *
 * No hay estado de "cartel rotulado": las fotos de talleres las sube el
 * superadmin desde el panel y no llevan el título impreso, así que el texto se
 * pinta siempre.
 */
export default function TarjetaTaller({ taller, destacado = false, onClick = () => {} }) {
  // La imagen se resuelve con la misma maquinaria que los eventos (issue #23):
  // tallerComoEvento() traduce el taller al vocabulario que entiende el hook, y
  // toda la lógica de elegir ilustrativa sigue viviendo en imagenesEvento.js.
  const { posterUrl, pos, onError, real } = useImagenEvento(tallerComoEvento(taller))
  const { fondo, trama } = cartelDe('salvia')
  const color = colorCategoriaTaller(taller.categoria)
  const nombreCategoria = nombreCategoriaTaller(taller.categoria)
  const turnos = taller.turnos || []
  // Sin foto propia (o con ilustrativa de galería) el texto tiene que contarlo
  // todo, así que se añade el bloque de turnos de la esquina.
  const conPlantillaEditorial = !posterUrl || !real

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block overflow-hidden rounded-lg text-left shadow-cartel transition-all hover:shadow-lg ${
        destacado ? 'aspect-[3/4] md:col-span-2 md:aspect-[16/9]' : 'aspect-[3/4]'
      }`}
    >
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={taller.nombre}
          loading="lazy"
          onError={onError}
          style={{ objectPosition: pos }}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className={`absolute inset-0 ${trama}`} style={{ background: fondo }} />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

      {/* Precio (arriba-izquierda), en el hueco donde un evento pone la hora */}
      {taller.precio && (
        <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 font-mono-ibm text-[11px] tracking-wider text-papel">
          {taller.precio}
        </div>
      )}

      {/* Número de turnos (arriba-derecha), en el hueco de la fecha editorial */}
      {conPlantillaEditorial && turnos.length > 0 && (
        <div
          className={`absolute right-3 flex flex-col items-center ${destacado ? 'top-11' : 'top-3'}`}
        >
          <span className="font-serif-dm text-3xl leading-none text-papel">{turnos.length}</span>
          <span className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-papel/60">
            {turnos.length === 1 ? 'turno' : 'turnos'}
          </span>
        </div>
      )}

      {destacado && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-oro px-2 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta">
          <MIcon name="star" className="text-[12px]" />
          Destacado
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
        <div className="inline-flex w-fit items-center gap-2">
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-oro">
            {nombreCategoria}
          </span>
        </div>

        <h3 className="line-clamp-2 font-serif-dm text-lg italic leading-tight text-papel md:text-xl">
          {taller.nombre}
        </h3>

        {turnos.length > 0 && (
          <div className="flex items-start gap-1 text-xs text-papel/80">
            <MIcon name="schedule" className="mt-0.5 flex-shrink-0 text-[13px]" />
            <span className="line-clamp-1">{textoTurno(turnos[0])}</span>
          </div>
        )}

        {taller.lugar && (
          <div className="flex items-start gap-1 text-xs text-papel/80">
            <MIcon name="location_on" className="mt-0.5 flex-shrink-0 text-[13px]" />
            <span className="line-clamp-1">{taller.lugar}</span>
          </div>
        )}

        {conPlantillaEditorial && taller.edades && (
          <div className="line-clamp-1 font-mono-ibm text-[10px] text-papel/60">
            {taller.edades}
          </div>
        )}
      </div>
    </button>
  )
}
