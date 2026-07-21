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
      className="max-w-sm border border-tinta bg-papel p-0 shadow-cartel backdrop:bg-tinta/40"
    >
      <div className="p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-terracota-fondo">
          <MIcon name="delete" className="text-[24px] text-terracota" />
        </div>

        <h2 className="font-serif-dm text-2xl text-tinta">{titulo}</h2>
        <p className="mt-2 font-serif-spectral text-sm text-tinta-apagada">{mensaje}</p>

        {/* Sin `-reverse`: el orden visual debe coincidir con el de tabulación,
            y la acción destructiva va la última en ambos. */}
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
            onClick={onConfirmar}
            disabled={ocupado}
            className="bg-terracota px-4 py-3 text-center font-mono-ibm text-xs uppercase tracking-etiqueta text-papel transition-opacity hover:enabled:opacity-90 disabled:opacity-50"
          >
            {ocupado ? 'Eliminando…' : textoConfirmar}
          </button>
        </div>
      </div>
    </dialog>
  )
}
