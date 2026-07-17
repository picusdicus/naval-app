import { useEffect, useRef, useState } from 'react'
import MIcon from '../MIcon.jsx'
import { hoyISO, sumarDias } from '../../lib/fechas.js'
import { PRESETS_DURACION, tarifaDe } from '../../lib/tarifasDestacados.js'

/**
 * Campos de la propuesta de vigencia de una solicitud de destacado: fecha de
 * inicio (no pasada) y duración con su tarifa. Los usa este diálogo (eventos)
 * y el formulario de DestacaNegocio (comercios), para que ambas solicitudes
 * propongan lo mismo. El estado lo lleva el padre.
 */
export function CamposPropuestaDestacado({ fechaInicio, duracionDias, onCambio, deshabilitado = false }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-2 block text-sm font-semibold">Inicio propuesto</label>
        <input
          type="date"
          min={hoyISO()}
          value={fechaInicio}
          onChange={(e) => onCambio({ fechaInicio: e.target.value })}
          className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
          disabled={deshabilitado}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold">Duración</label>
        <select
          value={duracionDias}
          onChange={(e) => onCambio({ duracionDias: Number(e.target.value) })}
          className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
          disabled={deshabilitado}
        >
          {PRESETS_DURACION.map((n) => (
            <option key={n} value={n}>
              {n} días — {tarifaDe(n)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-on-surface/60">
          Fin: {fechaInicio ? sumarDias(fechaInicio, duracionDias - 1) : '—'}
        </p>
      </div>
    </div>
  )
}

/**
 * Diálogo para solicitar destacar un evento desde /panel, con la propuesta de
 * fechas. Mismo patrón <dialog> que DialogoConfirmacion (foco, Escape y fondo
 * inerte gratis del navegador).
 */
export default function DialogoSolicitudDestacado({ abierto, titulo, ocupado = false, onConfirmar, onCancelar }) {
  const dialogo = useRef(null)
  const [fechaInicio, setFechaInicio] = useState(hoyISO())
  const [duracionDias, setDuracionDias] = useState(30)

  useEffect(() => {
    const elemento = dialogo.current
    if (!elemento) return

    if (abierto && !elemento.open) {
      // Cada apertura arranca con la propuesta por defecto: hoy + 30 días.
      setFechaInicio(hoyISO())
      setDuracionDias(30)
      elemento.showModal()
    }
    if (!abierto && elemento.open) elemento.close()
  }, [abierto])

  const propuestaValida = Boolean(fechaInicio) && fechaInicio >= hoyISO()

  return (
    <dialog
      ref={dialogo}
      onCancel={(e) => {
        e.preventDefault()
        if (!ocupado) onCancelar()
      }}
      className="w-full max-w-md rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-0 shadow-card-lg backdrop:bg-black/40"
    >
      <div className="p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-container">
          <MIcon name="star" className="text-[24px] text-on-primary" />
        </div>

        <h2 className="font-display text-lg font-bold text-on-surface">Solicitar destacado</h2>
        {titulo && <p className="mt-1 text-sm text-on-surface/70">{titulo}</p>}

        <div className="mt-4">
          <CamposPropuestaDestacado
            fechaInicio={fechaInicio}
            duracionDias={duracionDias}
            deshabilitado={ocupado}
            onCambio={({ fechaInicio: inicio, duracionDias: dias }) => {
              if (inicio !== undefined) setFechaInicio(inicio)
              if (dias !== undefined) setDuracionDias(dias)
            }}
          />
        </div>

        <p className="mt-3 text-xs text-on-surface/60">
          Las fechas son una propuesta: te contactaremos para confirmar las condiciones y el pago
          antes de activar el destacado.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancelar}
            disabled={ocupado}
            className="rounded-lg border border-outline-variant/40 px-5 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:enabled:bg-surface-container-high disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar({ fechaInicio, duracionDias })}
            disabled={ocupado || !propuestaValida}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:enabled:opacity-90 disabled:opacity-50"
          >
            {ocupado ? 'Enviando…' : 'Solicitar destacado'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
