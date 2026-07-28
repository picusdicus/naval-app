import { useState } from 'react'
import { Link } from 'react-router-dom'
import MIcon from '../MIcon.jsx'

// Tarjeta-cartel del directorio (La Gaceta), compartida por los dos niveles:
// categorías en la landing de Comercios y subcategorías dentro de cada
// categoría. Cartel a sangre con la foto si existe (`imagen` — se añaden a
// public/img/comercios/ sin tocar código) y, si no, el color con la trama
// diagonal y el símbolo grande, como los destacados sin foto.
//
// Móvil = estética impresa (recto, borde de tinta); desktop = redondeado con
// sombra (Opción B).
export default function TarjetaCategoria({ to, imagen, color, icono, nombre, total }) {
  const [conImagen, setConImagen] = useState(true)

  return (
    <Link
      to={to}
      aria-label={`${nombre}, ${total} ${total === 1 ? 'comercio' : 'comercios'}`}
      className="group relative block aspect-[4/3] w-full overflow-hidden border border-tinta transition-shadow md:rounded-lg md:border-0 md:shadow-cartel md:hover:shadow-tarjeta-gaceta"
    >
      {conImagen ? (
        <img
          src={imagen}
          alt=""
          onError={() => setConImagen(false)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="gz-trama-clara absolute inset-0" style={{ backgroundColor: color }}>
          <div className="absolute inset-0 flex items-center justify-center opacity-15">
            <MIcon name={icono} className="text-[110px] text-white" />
          </div>
        </div>
      )}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      <div className="absolute bottom-0 left-0 z-20 w-full p-3 md:p-4">
        <MIcon name={icono} className="text-[20px] text-papel/90" />
        <h3 className="mt-1 font-serif-dm text-xl leading-none text-papel md:text-2xl">
          {nombre}
        </h3>
        <p className="mt-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-papel/80">
          {total} {total === 1 ? 'comercio' : 'comercios'} →
        </p>
      </div>
    </Link>
  )
}
