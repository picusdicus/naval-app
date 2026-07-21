import { useEffect, useRef } from 'react'
import MIcon from '../MIcon.jsx'
import { campanaFinalizada, diasParaCaducar, textoCaducidad } from '../../lib/destacados.js'
import { formatearFechaLarga } from '../../lib/eventos.js'
import { duracionDe } from '../../lib/fechas.js'
import { tarifaDe } from '../../lib/tarifasDestacados.js'

const ETIQUETA_ESTADO = {
  pendiente: { icono: 'hourglass_top', texto: 'Solicitud pendiente', clases: 'bg-oro text-tinta' },
  activo: { icono: 'kid_star', texto: 'Destacado activo', clases: 'bg-tinta text-oro' },
}

function Linea({ etiqueta, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-filete-claro py-2 last:border-b-0">
      <dt className="font-serif-spectral text-sm text-pardo">{etiqueta}</dt>
      <dd className="text-right font-serif-spectral text-sm text-tinta">{children}</dd>
    </div>
  )
}

/**
 * Detalle de un destacado propio en /panel: estado, vigencia, duración,
 * tarifa e imagen contratada. Mismo patrón <dialog> que DialogoConfirmacion.
 * `destacado` es la fila del GET org-scoped; `titulo` el nombre del item.
 */
export default function DetalleDestacado({ destacado, titulo, onCerrar }) {
  const dialogo = useRef(null)
  const abierto = Boolean(destacado)

  useEffect(() => {
    const elemento = dialogo.current
    if (!elemento) return

    if (abierto && !elemento.open) elemento.showModal()
    if (!abierto && elemento.open) elemento.close()
  }, [abierto])

  const finalizada = campanaFinalizada(destacado)
  const dias = diasParaCaducar(destacado)
  const duracion =
    destacado?.fechaInicio && destacado?.fechaFin
      ? duracionDe(destacado.fechaInicio, destacado.fechaFin)
      : null
  const tarifa = duracion ? tarifaDe(duracion) : null
  const estado = finalizada
    ? { icono: 'kid_star', texto: 'Destacado finalizado', clases: 'bg-filete text-tinta-apagada' }
    : ETIQUETA_ESTADO[destacado?.estado]

  return (
    <dialog
      ref={dialogo}
      onCancel={(e) => {
        e.preventDefault()
        onCerrar()
      }}
      className="w-full max-w-md border border-tinta bg-papel p-0 shadow-cartel backdrop:bg-tinta/40"
    >
      {destacado && (
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-serif-dm text-2xl text-tinta">Tu destacado</h2>
              {titulo && <p className="mt-1 truncate font-serif-spectral text-sm italic text-pardo">{titulo}</p>}
            </div>
            <button
              type="button"
              onClick={onCerrar}
              className="p-1 text-pardo transition-colors hover:text-terracota"
              title="Cerrar"
            >
              <MIcon name="close" className="text-[20px]" />
            </button>
          </div>

          {estado && (
            <span className={`mt-3 inline-flex items-center gap-1 px-2 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta ${estado.clases}`}>
              <MIcon name={estado.icono} className="text-[14px]" fill={destacado.estado === 'activo' && !finalizada} />
              {estado.texto}
              {dias !== null && ` · ${textoCaducidad(dias)}`}
            </span>
          )}

          <dl className="mt-4">
            <Linea etiqueta="Inicio">
              {destacado.fechaInicio ? formatearFechaLarga(destacado.fechaInicio) : '—'}
            </Linea>
            <Linea etiqueta="Fin">
              {destacado.fechaFin ? formatearFechaLarga(destacado.fechaFin) : 'Sin fecha de fin'}
            </Linea>
            <Linea etiqueta="Duración">{duracion ? `${duracion} días` : '—'}</Linea>
            <Linea etiqueta="Tarifa">{tarifa ?? '—'}</Linea>
          </dl>

          {destacado.imagenUrl && (
            <img
              src={destacado.imagenUrl}
              alt=""
              className="mt-4 max-h-40 w-full border border-filete object-cover"
            />
          )}

          <p className="mt-4 font-serif-spectral text-xs leading-relaxed text-pardo">
            {destacado.estado === 'pendiente'
              ? 'Fechas propuestas por ti, pendientes de confirmación. Te contactaremos para cerrar condiciones y pago.'
              : 'El pago y las renovaciones se gestionan directamente con el equipo de la app.'}
          </p>
        </div>
      )}
    </dialog>
  )
}
