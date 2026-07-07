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
      className={`nv-card flex w-full items-center gap-3 p-3 text-left transition ${
        activo ? 'ring-2 ring-vino' : ''
      }`}
    >
      <span
        className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl text-crema"
        style={{ backgroundColor: cat?.color || '#2E6E8E' }}
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
