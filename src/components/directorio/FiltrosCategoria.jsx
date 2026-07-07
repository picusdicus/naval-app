import { LISTA_CATEGORIAS } from '../../lib/categorias.js'
import { IconoCategoria } from './iconosCategoria.jsx'
import { IconSearch } from '../icons.jsx'

export default function FiltrosCategoria({ categoria, onCategoria, busqueda, onBusqueda }) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-muted" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder="Buscar comercio…"
          className="w-full rounded-full border border-tierra/20 bg-white py-2 pl-9 pr-4 text-sm text-tinta outline-none focus:border-tierra"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onCategoria(null)}
          className={`flex-none rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            categoria === null
              ? 'bg-vino text-crema'
              : 'border border-tierra/20 bg-white text-tinta-muted hover:border-tierra'
          }`}
        >
          Todos
        </button>
        {LISTA_CATEGORIAS.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoria(cat.id)}
            className={`flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              categoria === cat.id
                ? 'bg-vino text-crema'
                : 'border border-tierra/20 bg-white text-tinta-muted hover:border-tierra'
            }`}
          >
            <IconoCategoria categoria={cat.id} className="h-3.5 w-3.5" />
            {cat.nombre}
          </button>
        ))}
      </div>
    </div>
  )
}
