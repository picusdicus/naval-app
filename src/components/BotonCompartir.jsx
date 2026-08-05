import { useState, useRef, useEffect } from 'react'
import MIcon from './MIcon.jsx'

export default function BotonCompartir() {
  const [mostrarPopover, setMostrarPopover] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const popoverRef = useRef(null)

  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
  const textoCompartir = 'Descubre la app de los vecinos de Navalcarnero 👉 ' + appUrl
  const urlWhatsapp = `https://wa.me/?text=${encodeURIComponent(textoCompartir)}`

  const soportaShare = navigator.share !== undefined

  const compartirNativo = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'En Navalcarnero',
          text: textoCompartir,
          url: appUrl,
        })
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error al compartir:', err)
        }
      }
    }
  }

  const copiarEnlace = () => {
    navigator.clipboard.writeText(appUrl).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  // Cerrar popover al clickear fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setMostrarPopover(false)
      }
    }

    if (mostrarPopover) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [mostrarPopover])

  return (
    <div className="relative" ref={popoverRef}>
      {soportaShare ? (
        // En móvil con soporte Share API
        <button
          onClick={compartirNativo}
          className="gz-boton-tinta inline-flex items-center gap-2"
        >
          <MIcon name="share" className="text-[16px]" />
          Compartir
        </button>
      ) : (
        // En escritorio: botón + popover
        <>
          <button
            onClick={() => setMostrarPopover(!mostrarPopover)}
            className="gz-boton-tinta inline-flex items-center gap-2"
          >
            <MIcon name="share" className="text-[16px]" />
            Compartir
          </button>

          {mostrarPopover && (
            <div className="absolute right-0 top-full z-10 mt-2 w-56 border border-tinta bg-papel p-3 shadow-cartel sm:w-64">
              <div className="space-y-2">
                <button
                  onClick={copiarEnlace}
                  className="flex w-full items-center gap-2 border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-papel-calido"
                >
                  <MIcon name={copiado ? 'check' : 'content_copy'} className="text-[16px]" />
                  {copiado ? 'Enlace copiado' : 'Copiar enlace'}
                </button>

                <a
                  href={urlWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-2 border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-papel-calido"
                >
                  <MIcon name="phone" className="text-[16px]" />
                  WhatsApp Web
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
