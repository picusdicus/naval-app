import { useState } from 'react'
import { Link } from 'react-router-dom'
import TarjetaCategoria from './TarjetaCategoria.jsx'
import { infoSubtipo } from '../../lib/subtipos.js'
import MIcon from '../MIcon.jsx'

// Segundo nivel de la landing de Comercios: dentro de una categoría, tarjetas
// por subcategoría (subtipo) con foto/contador — espejo del patrón de la
// landing. Las fotos siguen la convención
// public/img/comercios/<categoria>/<subtipo>.jpg, con el mismo fallback de
// color + trama + icono (el color es el de la categoría).
export default function SubcategoriasComercios({ categoria, subtipos, onBuscar }) {
  const [texto, setTexto] = useState('')
  const totalCategoria = subtipos.reduce((suma, s) => suma + s.total, 0)

  return (
    <div className="flex flex-col gap-8 px-4 pb-10 lg:px-0">
      {/* Buscador acotado a la categoría */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onBuscar(texto)
        }}
        className="relative"
      >
        <MIcon
          name="search"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-mudo"
        />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`Busca en ${categoria.nombre.toLowerCase()}…`}
          className="w-full border border-tinta bg-papel py-3 pl-11 pr-4 font-serif-spectral text-sm text-tinta outline-none placeholder:text-mudo md:rounded-full"
        />
      </form>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <header>
            <div className="gz-eyebrow">Por tipo de negocio</div>
            <h2 className="mt-1 font-serif-dm text-seccion-sm leading-none text-tinta md:text-seccion">
              {categoria.nombre}
            </h2>
            <p className="mt-2 font-serif-spectral text-sm text-pardo">
              {totalCategoria} {totalCategoria === 1 ? 'comercio' : 'comercios'} en{' '}
              {subtipos.length} {subtipos.length === 1 ? 'tipo' : 'tipos'}
            </p>
          </header>
          <Link to={`/comercios?categoria=${categoria.id}&ver=todos`} className="gz-boton-tinta">
            Ver todos →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {subtipos.map(({ subtipo, total }) => {
            const info = infoSubtipo(subtipo)
            return (
              <TarjetaCategoria
                key={subtipo}
                to={`/comercios?categoria=${categoria.id}&sub=${subtipo}`}
                imagen={`/img/comercios/${categoria.id}/${subtipo}.jpg`}
                color={categoria.color}
                icono={info.icono}
                nombre={info.nombre}
                total={total}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
