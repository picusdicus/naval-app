import { useState } from 'react'
import MIcon from '../MIcon.jsx'
import SelectorImagen from './SelectorImagen.jsx'
import { COMERCIOS_POR_ID } from '../../lib/destacados.js'

// Tarjeta de /panel para solicitar destacar el negocio vinculado a la cuenta.
// Solo se monta si la organización tiene `comercio_id` (lo vincula el
// superadmin). La foto es obligatoria: los comercios del directorio no tienen
// imagen propia y la tarjeta de destacado la necesita a sangre completa.
// `destacado` es la solicitud propia de tipo comercio (pendiente o activa),
// o null — las rechazadas se filtran antes y aquí vuelve a salir el formulario.
export default function DestacaNegocio({ comercioId, destacado, ocupado, onSolicitar, onRetirar }) {
  const [imagenUrl, setImagenUrl] = useState('')
  const comercio = COMERCIOS_POR_ID.get(comercioId)
  if (!comercio) return null

  return (
    <section className="nv-card mb-8 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-secondary-container">
          <MIcon name="storefront" className="text-[20px] text-on-secondary-container" />
        </div>
        <h2 className="font-display font-semibold text-on-surface">
          Destaca tu negocio: {comercio.nombre}
        </h2>
        {destacado?.estado === 'pendiente' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-container px-2.5 py-0.5 text-xs font-semibold text-on-tertiary-container">
            <MIcon name="hourglass_top" className="text-[14px]" />
            Solicitud enviada
          </span>
        )}
        {destacado?.estado === 'activo' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-semibold text-on-secondary-container">
            <MIcon name="kid_star" className="text-[14px]" fill />
            Destacado
          </span>
        )}
      </div>

      {!destacado && (
        <>
          <p className="mt-2 text-sm text-on-surface/70">
            Tu negocio aparecerá destacado en la portada y en la guía local. Te contactaremos
            para confirmar las condiciones.
          </p>
          <div className="mt-4 max-w-md">
            <SelectorImagen
              valor={imagenUrl}
              onChange={setImagenUrl}
              etiqueta="Foto de tu negocio"
              opcional={false}
            />
          </div>
          <button
            type="button"
            disabled={ocupado || !imagenUrl}
            onClick={() => onSolicitar(imagenUrl)}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-shadow hover:enabled:shadow-card-lg disabled:opacity-50"
          >
            <MIcon name="star" className="text-[18px]" />
            Solicitar destacado
          </button>
        </>
      )}

      {destacado?.estado === 'pendiente' && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-on-surface/70">
            Hemos recibido tu solicitud. Te contactaremos para confirmar las condiciones.
          </p>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onRetirar(destacado)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/40 px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:enabled:bg-surface-container-high disabled:opacity-50"
          >
            <MIcon name="star_half" className="text-[16px]" />
            Retirar solicitud
          </button>
        </div>
      )}

      {destacado?.estado === 'activo' && (
        <p className="mt-3 text-sm text-on-surface/70">
          Tu negocio está destacado en la portada y en la guía local
          {destacado.fechaFin ? ` hasta el ${destacado.fechaFin}` : ''}.
        </p>
      )}
    </section>
  )
}
