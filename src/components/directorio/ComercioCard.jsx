import { CATEGORIAS } from '../../lib/categorias.js'
import { tipoComercio } from '../../lib/cocinas.js'
import { IconoCategoria } from './iconosCategoria.jsx'

export default function ComercioCard({ comercio, activo, onClick }) {
  const cat = CATEGORIAS[comercio.categoria]
  const tipo = tipoComercio(comercio, cat?.nombre)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition-colors ${
        activo ? 'border-vino ring-1 ring-vino' : 'border-tierra/10 hover:border-tierra/40'
      }`}
    >
      <span
        className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-crema"
        style={{ backgroundColor: cat?.color || '#4E6A8A' }}
      >
        <IconoCategoria categoria={comercio.categoria} className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-tinta">{comercio.nombre}</span>
        <span className="block truncate text-xs text-tinta-muted">
          {tipo}
          {comercio.direccion ? ` · ${comercio.direccion}` : ''}
        </span>
      </span>
    </button>
  )
}
