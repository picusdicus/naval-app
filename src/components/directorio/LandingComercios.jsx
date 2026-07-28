import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LISTA_CATEGORIAS } from '../../lib/categorias.js'
import TarjetaCategoria from './TarjetaCategoria.jsx'
import { SIMBOLO_CATEGORIA } from './iconosCategoria.jsx'
import MIcon from '../MIcon.jsx'

// Tarjetas de categoría en orden alfabético, siempre todas visibles.
const CATEGORIAS_ORDENADAS = [...LISTA_CATEGORIAS].sort((a, b) =>
  a.nombre.localeCompare(b.nombre, 'es'),
)

// Landing del directorio de Comercios (La Gaceta): buscador, grid de tarjetas
// por tipo de negocio y CTA para dar de alta un comercio. Sin estado de datos
// propio — el padre (Mapa.jsx) navega por query params con los callbacks.
export default function LandingComercios({ total, conteos, onBuscar, onSugerir }) {
  const [texto, setTexto] = useState('')

  return (
    <div className="flex flex-col gap-8 px-4 pb-10 lg:px-0">
      {/* Buscador: navega al listado con la búsqueda aplicada (Enter o lupa) */}
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
          placeholder="Busca un comercio por nombre, calle o tipo…"
          className="w-full border border-tinta bg-papel py-3 pl-11 pr-4 font-serif-spectral text-sm text-tinta outline-none placeholder:text-mudo md:rounded-full"
        />
      </form>

      {/* Explora el directorio */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <header>
            <div className="gz-eyebrow">Explora el directorio</div>
            <h2 className="mt-1 font-serif-dm text-seccion-sm leading-none text-tinta md:text-seccion">
              ¿Qué <span className="italic">necesitas</span> hoy?
            </h2>
            <p className="mt-2 font-serif-spectral text-sm text-pardo">
              {total} comercios repartidos en {LISTA_CATEGORIAS.length} categorías
            </p>
          </header>
          <Link to="/comercios?ver=todos" className="gz-boton-tinta">
            Ver todos los comercios →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
          {CATEGORIAS_ORDENADAS.map((cat) => (
            <TarjetaCategoria
              key={cat.id}
              to={`/comercios?categoria=${cat.id}`}
              imagen={`/img/comercios/${cat.id}.jpg`}
              color={cat.color}
              icono={SIMBOLO_CATEGORIA[cat.id] || 'storefront'}
              nombre={cat.nombre}
              total={conteos[cat.id] ?? 0}
            />
          ))}
        </div>
      </section>

      {/* CTA para comerciantes */}
      <section className="flex flex-wrap items-center justify-between gap-4 border border-tinta bg-papel px-5 py-6 md:rounded-lg md:border-filete md:shadow-tarjeta-gaceta">
        <div>
          <h3 className="font-serif-dm text-xl text-tinta">¿Tienes un negocio en el pueblo?</h3>
          <p className="mt-1 font-serif-spectral text-sm text-pardo">
            Da de alta tu comercio y aparece en el directorio.
          </p>
        </div>
        <button
          type="button"
          onClick={onSugerir}
          className="gz-boton-tinta inline-flex items-center gap-1.5"
        >
          <MIcon name="add" className="text-[14px]" />
          Dar de alta
        </button>
      </section>
    </div>
  )
}
