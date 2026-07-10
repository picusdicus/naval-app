import { useEffect, useRef } from 'react'
import MIcon from '../MIcon.jsx'

/**
 * Diálogo modal de confirmación para acciones destructivas. Se apoya en
 * <dialog>, que ya trae del navegador el foco atrapado, el cierre con Escape
 * y el fondo inerte.
 */
export default function DialogoConfirmacion({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Eliminar',
  ocupado = false,
  onConfirmar,
  onCancelar,
}) {
  const dialogo = useRef(null)

  useEffect(() => {
    const elemento = dialogo.current
    if (!elemento) return

    if (abierto && !elemento.open) elemento.showModal()
    if (!abierto && elemento.open) elemento.close()
  }, [abierto])

  return (
    <dialog
      ref={dialogo}
      // Escape cierra el <dialog> por su cuenta: hay que avisar al padre.
      onCancel={(e) => {
        e.preventDefault()
        if (!ocupado) onCancelar()
      }}
      className="max-w-sm rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-0 shadow-card-lg backdrop:bg-black/40"
    >
      <div className="p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error/10">
          <MIcon name="delete" className="text-[24px] text-error" />
        </div>

        <h2 className="font-display text-lg font-bold text-on-surface">{titulo}</h2>
        <p className="mt-2 text-sm text-on-surface/70">{mensaje}</p>

        {/* Sin `-reverse`: el orden visual debe coincidir con el de tabulación,
            y la acción destructiva va la última en ambos. */}
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
            onClick={onConfirmar}
            disabled={ocupado}
            className="rounded-lg bg-error px-5 py-2.5 text-sm font-semibold text-on-error transition-opacity hover:enabled:opacity-90 disabled:opacity-50"
          >
            {ocupado ? 'Eliminando…' : textoConfirmar}
          </button>
        </div>
      </div>
    </dialog>
  )
}
