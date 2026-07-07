import { CATEGORIAS } from '../../lib/categorias.js'
import { etiquetasCocina } from '../../lib/cocinas.js'
import { IconoCategoria } from './iconosCategoria.jsx'
import { IconClose, IconPin, IconPhone, IconGlobe, IconClock, IconRoute } from '../icons.jsx'

function normalizarWeb(web) {
  if (!web) return ''
  return web.startsWith('http') ? web : `https://${web}`
}

export default function ComercioDetalle({ comercio, onCerrar }) {
  const cat = CATEGORIAS[comercio.categoria]
  const tieneCoords = typeof comercio.lat === 'number' && typeof comercio.lng === 'number'
  const cocinas = etiquetasCocina(comercio.cocina || [])
  const comoLlegar = `https://www.openstreetmap.org/directions?to=${comercio.lat},${comercio.lng}`
  const web = normalizarWeb(comercio.web)

  return (
    <div className="rounded-2xl border border-tierra/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-crema"
            style={{ backgroundColor: cat?.color || '#4E6A8A' }}
          >
            <IconoCategoria categoria={comercio.categoria} className="h-6 w-6" />
          </span>
          <div>
            <h3 className="font-medium text-tinta">{comercio.nombre}</h3>
            <p className="text-xs text-tinta-muted">
              {cat?.nombre}
              {comercio.ejemplo && ' · ejemplo'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar ficha"
          className="rounded-full p-1 text-tinta-muted hover:bg-crema-dark"
        >
          <IconClose className="h-5 w-5" />
        </button>
      </div>

      {cocinas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cocinas.map((c) => (
            <span
              key={c}
              className="rounded-full bg-vino/10 px-2.5 py-0.5 text-xs font-medium text-vino"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {comercio.descripcion && (
        <p className="mt-3 text-sm text-tinta">{comercio.descripcion}</p>
      )}

      <dl className="mt-4 space-y-2 text-sm">
        {comercio.direccion && (
          <div className="flex items-start gap-2 text-tinta">
            <IconPin className="mt-0.5 h-4 w-4 flex-none text-tierra" />
            <span>{comercio.direccion}</span>
          </div>
        )}
        {comercio.telefono && (
          <div className="flex items-center gap-2 text-tinta">
            <IconPhone className="h-4 w-4 flex-none text-tierra" />
            <a href={`tel:${comercio.telefono}`} className="text-vino underline-offset-2 hover:underline">
              {comercio.telefono}
            </a>
          </div>
        )}
        {web && (
          <div className="flex items-center gap-2 text-tinta">
            <IconGlobe className="h-4 w-4 flex-none text-tierra" />
            <a
              href={web}
              target="_blank"
              rel="noreferrer"
              className="truncate text-vino underline-offset-2 hover:underline"
            >
              {comercio.web}
            </a>
          </div>
        )}
        {comercio.horario && (
          <div className="flex items-start gap-2 text-tinta">
            <IconClock className="mt-0.5 h-4 w-4 flex-none text-tierra" />
            <span>{comercio.horario}</span>
          </div>
        )}
        {!comercio.direccion && !comercio.telefono && !web && !comercio.horario && (
          <p className="text-xs text-tinta-muted">
            Sin datos de contacto todavía. ¿Los conoces? Sugiere una corrección.
          </p>
        )}
      </dl>

      {tieneCoords && (
        <a
          href={comoLlegar}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center justify-center gap-2 rounded-full bg-vino px-4 py-2 text-sm font-medium text-crema"
        >
          <IconRoute className="h-4 w-4" />
          Cómo llegar
        </a>
      )}
    </div>
  )
}
