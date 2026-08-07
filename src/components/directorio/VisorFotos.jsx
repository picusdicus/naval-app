import { useCallback, useEffect } from 'react'
import MIcon from '../MIcon.jsx'

/**
 * Visor a pantalla completa de la galería de un comercio: la foto entera
 * (`object-contain`, sin recortes como en la cuadrícula), flechas, contador y
 * cierre con Escape, clic en el fondo o la X.
 *
 * Se monta solo cuando hay una foto abierta: `indice` null = cerrado.
 */
export default function VisorFotos({ fotos, indice, onCerrar, onCambiar }) {
  const abierto = indice !== null && indice !== undefined && fotos.length > 0

  const mover = useCallback(
    (paso) => {
      if (!abierto) return
      onCambiar((indice + paso + fotos.length) % fotos.length)
    },
    [abierto, indice, fotos.length, onCambiar],
  )

  // Teclado: Escape cierra, flechas navegan. Mientras está abierto se bloquea
  // el scroll del fondo para que el gesto no mueva la página de debajo.
  useEffect(() => {
    if (!abierto) return
    const alPulsar = (e) => {
      if (e.key === 'Escape') onCerrar()
      else if (e.key === 'ArrowRight') mover(1)
      else if (e.key === 'ArrowLeft') mover(-1)
    }
    document.addEventListener('keydown', alPulsar)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.body.style.overflow = overflow
    }
  }, [abierto, mover, onCerrar])

  if (!abierto) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto ampliada"
      onClick={onCerrar}
      // Fondo en línea (no con una clase de opacidad) para que no dependa de
      // nada: la foto tiene que leerse sobre negro, no sobre la página.
      style={{ backgroundColor: 'rgba(10, 8, 6, 0.94)' }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10"
    >
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25"
      >
        <MIcon name="close" className="text-[20px]" />
      </button>

      {fotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              mover(-1)
            }}
            aria-label="Foto anterior"
            className="absolute left-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 sm:left-6"
          >
            <MIcon name="chevron_left" className="text-[22px]" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              mover(1)
            }}
            aria-label="Foto siguiente"
            className="absolute right-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 sm:right-6"
          >
            <MIcon name="chevron_right" className="text-[22px]" />
          </button>
        </>
      )}

      {/* La foto no cierra el visor al pulsarla: solo el fondo */}
      <img
        src={fotos[indice]}
        alt={`Foto ${indice + 1} de ${fotos.length}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full object-contain"
      />

      {fotos.length > 1 && (
        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 font-mono-ibm text-[11px] tracking-etiqueta text-white">
          {indice + 1} / {fotos.length}
        </span>
      )}
    </div>
  )
}
