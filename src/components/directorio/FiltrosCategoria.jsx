import { LISTA_CATEGORIAS } from '../../lib/categorias.js'
import MIcon from '../MIcon.jsx'

export default function FiltrosCategoria({ categoria, onCategoria, busqueda, onBusqueda }) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <MIcon
          name="search"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant"
        />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder="¿Qué estás buscando hoy?"
          className="w-full rounded-full border border-outline-variant bg-surface-container-lowest py-3 pl-12 pr-4 text-sm text-on-surface shadow-card outline-none transition-colors focus:border-primary"
        />
      </div>

      <div className="hide-scrollbar flex gap-3 overflow-x-auto py-1">
        <button
          type="button"
          onClick={() => onCategoria(null)}
          className={`nv-chip flex-none whitespace-nowrap transition-all ${
            categoria === null
              ? 'bg-primary text-on-primary shadow-md'
              : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          Todos
        </button>
        {LISTA_CATEGORIAS.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoria(cat.id)}
            className={`nv-chip flex-none whitespace-nowrap transition-all ${
              categoria === cat.id
                ? 'bg-primary text-on-primary shadow-md'
                : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {cat.nombre}
          </button>
        ))}
      </div>
    </div>
  )
}
