import { useState } from 'react'
import MIcon from '../MIcon.jsx'
import SelectorImagen from './SelectorImagen.jsx'
import { CamposPropuestaDestacado } from './DialogoSolicitudDestacado.jsx'
import { campanaFinalizada, COMERCIOS_POR_ID, diasParaCaducar, textoCaducidad } from '../../lib/destacados.js'
import { formatearFechaLarga } from '../../lib/eventos.js'
import { hoyISO } from '../../lib/fechas.js'

// Tarjeta de /panel para solicitar destacar el negocio vinculado a la cuenta.
// Solo se monta si la organización tiene `comercio_id` (lo vincula el
// superadmin). La foto es obligatoria: los comercios del directorio no tienen
// imagen propia y la tarjeta de destacado la necesita a sangre completa.
// `destacado` es la solicitud propia de tipo comercio (pendiente o activa),
// o null — las rechazadas se filtran antes y aquí vuelve a salir el formulario.
export default function DestacaNegocio({ comercioId, destacado, ocupado, onSolicitar, onRetirar, onVerDetalle }) {
  const [imagenUrl, setImagenUrl] = useState('')
  const [fechaInicio, setFechaInicio] = useState(hoyISO)
  const [duracionDias, setDuracionDias] = useState(30)
  const comercio = COMERCIOS_POR_ID.get(comercioId)
  if (!comercio) return null

  const propuestaValida = Boolean(fechaInicio) && fechaInicio >= hoyISO()

  return (
    <section className="gz-tarjeta-impresa mb-8 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-verde-salvia">
          <MIcon name="storefront" className="text-[20px] text-papel" />
        </div>
        <h2 className="font-serif-dm text-lg leading-tight text-tinta">
          Destaca tu negocio: {comercio.nombre}
        </h2>
        {destacado?.estado === 'pendiente' && (
          <span className="inline-flex items-center gap-1 bg-oro px-2 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-tinta">
            <MIcon name="hourglass_top" className="text-[14px]" />
            Solicitud enviada
          </span>
        )}
        {/* Activo con la campaña terminada: que la org no crea que sigue en vigor. */}
        {campanaFinalizada(destacado) && (
          <span className="inline-flex items-center gap-1 bg-filete px-2 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-tinta-apagada">
            <MIcon name="kid_star" className="text-[14px]" />
            Destacado finalizado
          </span>
        )}
        {destacado?.estado === 'activo' && !campanaFinalizada(destacado) && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta ${
              diasParaCaducar(destacado) !== null
                ? 'bg-tinta text-oro'
                : 'bg-tinta text-oro'
            }`}
          >
            <MIcon name="kid_star" className="text-[14px]" fill />
            {diasParaCaducar(destacado) !== null
              ? `Destacado · ${textoCaducidad(diasParaCaducar(destacado))}`
              : 'Destacado'}
          </span>
        )}
        {destacado && (
          <button
            type="button"
            onClick={() => onVerDetalle(destacado, comercio.nombre)}
            className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota underline-offset-2 hover:underline"
          >
            Ver detalle
          </button>
        )}
      </div>

      {!destacado && (
        <>
          <p className="mt-2 font-serif-spectral text-sm text-pardo">
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
          <div className="mt-4 max-w-md">
            <CamposPropuestaDestacado
              fechaInicio={fechaInicio}
              duracionDias={duracionDias}
              deshabilitado={ocupado}
              onCambio={({ fechaInicio: inicio, duracionDias: dias }) => {
                if (inicio !== undefined) setFechaInicio(inicio)
                if (dias !== undefined) setDuracionDias(dias)
              }}
            />
            <p className="mt-2 font-serif-spectral text-xs text-pardo">
              Las fechas son una propuesta: te contactaremos para confirmar las condiciones y el
              pago antes de activar el destacado.
            </p>
          </div>
          <button
            type="button"
            disabled={ocupado || !imagenUrl || !propuestaValida}
            onClick={() => onSolicitar(imagenUrl, { fechaInicio, duracionDias })}
            className="gz-boton-tinta mt-4 inline-flex items-center gap-2 disabled:opacity-50"
          >
            <MIcon name="star" className="text-[18px]" />
            Solicitar destacado
          </button>
        </>
      )}

      {destacado?.estado === 'pendiente' && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="font-serif-spectral text-sm text-pardo">
            Hemos recibido tu solicitud. Te contactaremos para confirmar las condiciones.
          </p>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onRetirar(destacado)}
            className="inline-flex items-center gap-1.5 border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:enabled:bg-papel-calido disabled:opacity-50"
          >
            <MIcon name="star_half" className="text-[16px]" />
            Retirar solicitud
          </button>
        </div>
      )}

      {destacado?.estado === 'activo' && !campanaFinalizada(destacado) && (
        <p className="mt-3 font-serif-spectral text-sm text-pardo">
          Tu negocio está destacado en la portada y en la guía local
          {destacado.fechaFin ? ` hasta el ${formatearFechaLarga(destacado.fechaFin)}` : ''}.
        </p>
      )}
      {campanaFinalizada(destacado) && (
        <p className="mt-3 font-serif-spectral text-sm text-pardo">
          Tu campaña de destacado ha terminado. Si quieres renovarla, contacta con nosotros.
        </p>
      )}
    </section>
  )
}
