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
      className={`nv-card flex w-full items-center gap-3 p-3.5 text-left transition-all hover:shadow-card-lg ${
        activo ? 'ring-2 ring-primary' : ''
      }`}
    >
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
        <IconoCategoria categoria={comercio.categoria} className="text-[22px]" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-on-surface">
          {comercio.nombre}
        </span>
        <span className="block truncate text-xs text-on-surface-variant">
          {tipo}
          {comercio.direccion ? ` · ${comercio.direccion}` : ''}
        </span>
      </span>
    </button>
  )
}
