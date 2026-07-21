import { LISTA_CATEGORIAS } from '../../lib/categorias.js'
import MIcon from '../MIcon.jsx'

// Buscador + chips de categoría del directorio (La Gaceta): input con borde de
// tinta y chips impresos (activo en tinta, resto con borde).
export default function FiltrosCategoria({ categoria, onCategoria, busqueda, onBusqueda }) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <MIcon
          name="search"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-mudo"
        />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder="¿Qué buscas hoy?"
          className="w-full border border-tinta bg-papel py-3 pl-11 pr-4 font-serif-spectral text-sm text-tinta outline-none placeholder:text-mudo"
        />
      </div>

      <div className="hide-scrollbar flex gap-2 overflow-x-auto py-1 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta">
        <button
          type="button"
          onClick={() => onCategoria(null)}
          className={`flex-none whitespace-nowrap px-3 py-2 transition-colors ${
            categoria === null ? 'bg-tinta text-papel' : 'border border-tinta text-tinta hover:bg-papel-calido'
          }`}
        >
          Todos
        </button>
        {LISTA_CATEGORIAS.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoria(cat.id)}
            className={`flex-none whitespace-nowrap px-3 py-2 transition-colors ${
              categoria === cat.id ? 'bg-tinta text-papel' : 'border border-tinta text-tinta hover:bg-papel-calido'
            }`}
          >
            {cat.nombre}
          </button>
        ))}
      </div>
    </div>
  )
}
