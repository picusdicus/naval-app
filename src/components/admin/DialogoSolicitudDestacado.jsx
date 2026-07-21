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
        <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
          Inicio propuesto
        </label>
        <input
          type="date"
          min={hoyISO()}
          value={fechaInicio}
          onChange={(e) => onCambio({ fechaInicio: e.target.value })}
          className="w-full border border-tinta bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:outline-none"
          disabled={deshabilitado}
        />
      </div>
      <div>
        <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
          Duración
        </label>
        <select
          value={duracionDias}
          onChange={(e) => onCambio({ duracionDias: Number(e.target.value) })}
          className="w-full border border-tinta bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:outline-none"
          disabled={deshabilitado}
        >
          {PRESETS_DURACION.map((n) => (
            <option key={n} value={n}>
              {n} días — {tarifaDe(n)}
            </option>
          ))}
        </select>
        <p className="mt-1 font-mono-ibm text-[10px] text-mudo">
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
      className="w-full max-w-md border border-tinta bg-papel p-0 shadow-cartel backdrop:bg-tinta/40"
    >
      <div className="p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-tinta">
          <MIcon name="star" className="text-[24px] text-oro" fill />
        </div>

        <h2 className="font-serif-dm text-2xl text-tinta">Solicitar destacado</h2>
        {titulo && <p className="mt-1 font-serif-spectral text-sm italic text-pardo">{titulo}</p>}

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

        <p className="mt-3 font-serif-spectral text-xs leading-relaxed text-pardo">
          Las fechas son una propuesta: te contactaremos para confirmar las condiciones y el pago
          antes de activar el destacado.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancelar}
            disabled={ocupado}
            className="gz-boton-borde hover:enabled:bg-papel-calido disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar({ fechaInicio, duracionDias })}
            disabled={ocupado || !propuestaValida}
            className="gz-boton-tinta disabled:opacity-50"
          >
            {ocupado ? 'Enviando…' : 'Solicitar destacado'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
