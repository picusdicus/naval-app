import { Link } from 'react-router-dom'
import MIcon from '../MIcon.jsx'
import { reportarClicDestacado } from '../../lib/useAnalytics.js'

// Tarjeta de destacado (La Gaceta): cartel a sangre con degradado oscuro
// inferior, badge oro arriba-izquierda, título en DM Serif itálica y líneas de
// meta en mono. Si el item no tiene foto (comercios sin imagen contratada),
// pinta el color de su categoría con la trama diagonal y el símbolo grande.
//
// `destacado` es la forma que devuelven los adaptadores de src/lib/destacados.js.
// Con `onClick` se renderiza como botón (la franja del Mapa selecciona la ficha
// en la propia página); sin él, como <Link> a `destacado.to`. Con `seccion`
// (superficie que la muestra) el clic se registra en analytics — sendBeacon
// sobrevive a la navegación del Link.
//
// Móvil = estética impresa (recto, borde de tinta); desktop = redondeado con
// sombra (Opción B): mientras no llega el carrusel inmersivo de la Fase 2, la
// tarjeta sirve a ambas superficies con clases responsive.
export default function TarjetaDestacado({ destacado, tamano = 'normal', onClick, seccion }) {
  const grande = tamano === 'grande'
  const registrarClic = seccion ? () => reportarClicDestacado(destacado, seccion) : undefined

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
        <div
          className="gz-trama-clara absolute inset-0"
          style={{ backgroundColor: destacado.colorCategoria || '#4a5b41' }}
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-15">
            <MIcon
              name={destacado.simbolo}
              className={`${grande ? 'text-[180px]' : 'text-[120px]'} text-white`}
            />
          </div>
        </div>
      )}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      {/* Badge oro arriba-izquierda */}
      <span className="gz-badge-oro absolute left-3 top-3 z-20">{destacado.badge}</span>
      <div className={`absolute bottom-0 left-0 z-20 w-full ${grande ? 'p-5' : 'p-4'}`}>
        <h3
          className={`font-serif-dm italic leading-[0.9] text-papel ${
            grande ? 'text-3xl md:text-4xl' : 'text-2xl'
          }`}
        >
          {destacado.titulo}
        </h3>
        {destacado.lineas.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-papel/80">
            {destacado.lineas.map((linea) => (
              <div key={`${linea.icono}-${linea.texto}`} className="flex items-center gap-1">
                <MIcon name={linea.icono} className="text-[13px]" />
                <span>{linea.texto}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )

  const clases = `group relative block w-full overflow-hidden border border-tinta transition-shadow md:rounded-lg md:border-0 md:shadow-cartel md:hover:shadow-tarjeta-gaceta ${
    grande ? 'h-72 md:h-80' : 'aspect-[3/4] md:aspect-auto md:h-56'
  }`

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => {
          registrarClic?.()
          onClick()
        }}
        className={`${clases} text-left`}
      >
        {contenido}
      </button>
    )
  }

  return (
    <Link to={destacado.to} onClick={registrarClic} className={clases}>
      {contenido}
    </Link>
  )
}
