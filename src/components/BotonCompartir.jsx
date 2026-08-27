import { useState, useRef, useEffect } from 'react'
import MIcon from './MIcon.jsx'

export default function BotonCompartir({
  titulo = 'En Navalcarnero',
  url = null,
  textoCompartir = null,
  conEmail = false, // En modo app (sin props personalizados) no tiene sentido email; en modo evento es natural.
}) {
  const [mostrarPopover, setMostrarPopover] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const popoverRef = useRef(null)

  const appUrl = url || import.meta.env.VITE_APP_URL || window.location.origin
  const textoDefault = 'Descubre la app de los vecinos de Navalcarnero 👉 ' + appUrl
  const textoFinal = textoCompartir ?? textoDefault
  const urlWhatsapp = `https://wa.me/?text=${encodeURIComponent(textoFinal)}`
  const urlEmail = `mailto:?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(textoFinal)}`

  const soportaShare = navigator.share !== undefined

  const compartirNativo = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: titulo,
          text: textoFinal,
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
          className="gz-boton-minimo inline-flex items-center gap-2"
        >
          <MIcon name="share" className="text-[16px]" />
          Compartir
        </button>
      ) : (
        // En escritorio: botón + popover
        <>
          <button
            onClick={() => setMostrarPopover(!mostrarPopover)}
            className="gz-boton-minimo inline-flex items-center gap-2"
          >
            <MIcon name="share" className="text-[16px]" />
            Compartir
          </button>

          {mostrarPopover && (
            <div className="absolute right-0 top-full z-10 mt-3 w-56 rounded bg-papel p-4 shadow-lg sm:w-64">
              <div className="space-y-1">
                <button
                  onClick={copiarEnlace}
                  className="flex w-full items-center gap-3 rounded px-3 py-2.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-filete-punteado/20"
                >
                  <MIcon name={copiado ? 'check' : 'content_copy'} className="text-[16px]" />
                  <span className="flex-1 text-left">{copiado ? 'Enlace copiado' : 'Copiar enlace'}</span>
                </button>

                <a
                  href={urlWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-3 rounded px-3 py-2.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-filete-punteado/20"
                >
                  <MIcon name="phone" className="text-[16px]" />
                  <span className="flex-1 text-left">WhatsApp Web</span>
                </a>

                {conEmail && (
                  <a
                    href={urlEmail}
                    className="flex w-full items-center gap-3 rounded px-3 py-2.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-filete-punteado/20"
                  >
                    <MIcon name="mail" className="text-[16px]" />
                    <span className="flex-1 text-left">Enviar por correo</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
