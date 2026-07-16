import TarjetaDestacado from './TarjetaDestacado.jsx'

// En móvil, carrusel horizontal con scroll-snap (cada tarjeta ocupa ~80% del
// ancho, dejando asomar la siguiente); en escritorio, grid de N columnas.
// Con `soloCarrusel` se mantiene el carrusel en todos los breakpoints, con
// tarjetas estrechas — lo necesita la columna izquierda del Mapa (lg:w-2/5).
//
// Pendiente de pulido (anotado en el plan, no bloqueante): el carrusel móvil
// no tiene indicador de que hay más contenido a la derecha ni navegación por
// teclado más allá del foco de cada tarjeta.

// Tailwind no ve clases construidas dinámicamente: el nº de columnas se
// resuelve contra este mapa estático.
const COLUMNAS = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
}

export default function CarruselDestacados({
  items,
  tamano = 'normal',
  columnas = 3,
  soloCarrusel = false,
  onItemClick,
}) {
  if (!items || items.length === 0) return null

  const contenedor = soloCarrusel
    ? 'hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1'
    : `hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 md:grid ${
        COLUMNAS[columnas] || COLUMNAS[3]
      } md:gap-4 md:overflow-visible md:pb-0`

  const envoltorio = soloCarrusel
    ? 'w-56 flex-none snap-start'
    : 'w-[80%] max-w-xs flex-none snap-start md:w-auto md:max-w-none'

  return (
    <div className={contenedor}>
      {items.map((destacado) => (
        <div key={destacado.id} className={envoltorio}>
          <TarjetaDestacado
            destacado={destacado}
            tamano={tamano}
            onClick={onItemClick ? () => onItemClick(destacado.item) : undefined}
          />
        </div>
      ))}
    </div>
  )
}
