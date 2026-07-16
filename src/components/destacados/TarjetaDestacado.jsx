import { Link } from 'react-router-dom'
import MIcon from '../MIcon.jsx'

// Tarjeta de destacado: foto a sangre completa con degradado oscuro inferior,
// pastilla de categoría, título en blanco y líneas de detalle con icono —
// el mismo lenguaje visual que el hero de Eventos. Si el item no tiene foto
// (comercios sin imagen contratada), pinta el color de su categoría con el
// símbolo grande de fondo.
//
// `destacado` es la forma que devuelven los adaptadores de src/lib/destacados.js.
// Con `onClick` se renderiza como botón (la franja del Mapa selecciona la ficha
// en la propia página); sin él, como <Link> a `destacado.to`.
export default function TarjetaDestacado({ destacado, tamano = 'normal', onClick }) {
  const grande = tamano === 'grande'

  const contenido = (
    <>
      {destacado.imagen ? (
        <img
          src={destacado.imagen}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          style={{ objectPosition: destacado.imagenPos || '50% 50%' }}
        />
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{ backgroundColor: destacado.colorCategoria || '#0f5238' }}
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-15">
            <MIcon
              name={destacado.simbolo}
              className={`${grande ? 'text-[180px]' : 'text-[120px]'} text-white`}
            />
          </div>
        </>
      )}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
      <div className={`absolute bottom-0 left-0 z-20 w-full ${grande ? 'p-6' : 'p-4'}`}>
        <span className="mb-2 inline-block rounded-full bg-secondary-container px-3 py-1 text-xs font-medium text-on-secondary-container">
          {destacado.badge}
        </span>
        <h3
          className={`font-display font-semibold text-white ${
            grande ? 'mb-2 text-xl md:text-2xl' : 'text-base md:text-lg'
          }`}
        >
          {destacado.titulo}
        </h3>
        {destacado.lineas.length > 0 && (
          <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold text-white/90 ${
              grande ? 'text-sm' : 'mt-1 text-xs md:text-sm'
            }`}
          >
            {destacado.lineas.map((linea) => (
              <div key={`${linea.icono}-${linea.texto}`} className="flex items-center gap-1">
                <MIcon name={linea.icono} className={grande ? 'text-[18px]' : 'text-[16px]'} />
                <span>{linea.texto}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )

  const clases = `group relative block w-full overflow-hidden rounded-xl shadow-card transition-shadow hover:shadow-card-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
    grande ? 'h-64 md:h-80' : 'h-48 md:h-56'
  }`

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${clases} text-left`}>
        {contenido}
      </button>
    )
  }

  return (
    <Link to={destacado.to} className={clases}>
      {contenido}
    </Link>
  )
}
