import { CATEGORIAS } from '../../lib/categorias.js'
import { etiquetasCocina } from '../../lib/cocinas.js'
import { IconoCategoria } from './iconosCategoria.jsx'
import MIcon from '../MIcon.jsx'

function normalizarWeb(web) {
  if (!web) return ''
  return web.startsWith('http') ? web : `https://${web}`
}

export default function ComercioDetalle({ comercio, onCerrar }) {
  const cat = CATEGORIAS[comercio.categoria]
  const tieneCoords = typeof comercio.lat === 'number' && typeof comercio.lng === 'number'
  const cocinas = etiquetasCocina(comercio.cocina || [])
  // API oficial de URLs de Google Maps (gratuita, sin clave): direcciones y
  // ficha del negocio (fotos, reseñas, horarios) buscando por nombre + municipio.
  const comoLlegar = `https://www.google.com/maps/dir/?api=1&destination=${comercio.lat},${comercio.lng}`
  const verEnGoogleMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${comercio.nombre}, Navalcarnero`,
  )}`
  const web = normalizarWeb(comercio.web)

  return (
    <div className="nv-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
            <IconoCategoria categoria={comercio.categoria} className="text-[24px]" />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold text-on-surface">
              {comercio.nombre}
            </h3>
            <p className="text-xs text-on-surface-variant">
              {cat?.nombre}
              {comercio.ejemplo && ' · ejemplo'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar ficha"
          className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <MIcon name="close" className="text-[20px]" />
        </button>
      </div>

      {cocinas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cocinas.map((c) => (
            <span
              key={c}
              className="rounded-full bg-secondary-container px-3 py-1 text-xs font-medium text-on-secondary-container"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {comercio.descripcion && (
        <p className="mt-3 text-sm text-on-surface">{comercio.descripcion}</p>
      )}

      <dl className="mt-4 space-y-2 text-sm">
        {comercio.direccion && (
          <div className="flex items-start gap-2 text-on-surface">
            <MIcon name="location_on" className="mt-0.5 text-[18px] text-secondary" />
            <span>{comercio.direccion}</span>
          </div>
        )}
        {comercio.telefono && (
          <div className="flex items-center gap-2 text-on-surface">
            <MIcon name="call" className="text-[18px] text-secondary" />
            <a
              href={`tel:${comercio.telefono}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              {comercio.telefono}
            </a>
          </div>
        )}
        {web && (
          <div className="flex items-center gap-2 text-on-surface">
            <MIcon name="language" className="text-[18px] text-secondary" />
            <a
              href={web}
              target="_blank"
              rel="noreferrer"
              className="truncate text-primary underline-offset-2 hover:underline"
            >
              {comercio.web}
            </a>
          </div>
        )}
        {comercio.horario && (
          <div className="flex items-start gap-2 text-on-surface">
            <MIcon name="schedule" className="mt-0.5 text-[18px] text-secondary" />
            <span>{comercio.horario}</span>
          </div>
        )}
        {!comercio.direccion && !comercio.telefono && !web && !comercio.horario && (
          <p className="text-xs text-on-surface-variant">
            Sin datos de contacto todavía. ¿Los conoces? Sugiere una corrección.
          </p>
        )}
      </dl>

      {tieneCoords && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a
            href={comoLlegar}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-all hover:bg-primary-container active:scale-95"
          >
            <MIcon name="directions" className="text-[18px]" />
            Cómo llegar
          </a>
          <a
            href={verEnGoogleMaps}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-outline px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <MIcon name="map" className="text-[18px]" />
            Ver en Google Maps
          </a>
        </div>
      )}
    </div>
  )
}
