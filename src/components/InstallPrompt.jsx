import { useState, useEffect } from 'react'
import MIcon from './MIcon'
import { suscribirPromptInstalacion, pedirInstalacionNativa } from '../lib/instalacion.js'

export default function InstallPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Si ya fue descartado en esta sesión, no mostrar
    if (sessionStorage.getItem('install-dismissed')) {
      return
    }

    // La captura del evento vive en lib/instalacion.js (compartida con el
    // botón "Instalar app" del menú lateral); aquí solo se reacciona a ella.
    return suscribirPromptInstalacion(() => setShow(true))
  }, [])

  const handleInstall = async () => {
    const outcome = await pedirInstalacionNativa()
    if (outcome === 'accepted') {
      setShow(false)
      sessionStorage.setItem('install-dismissed', 'true')
    }
  }

  const handleDismiss = () => {
    setShow(false)
    sessionStorage.setItem('install-dismissed', 'true')
  }

  if (!show) return null

  return (
    <div className="animate-rise fixed bottom-24 left-4 right-4 z-40 lg:bottom-6 lg:right-6 lg:w-auto lg:max-w-sm">
      <div className="border border-tinta bg-papel-calido p-4 shadow-cartel">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 pt-0.5">
            <MIcon name="mobile_screen_share" className="text-[24px] text-terracota" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 font-serif-dm text-lg leading-tight text-tinta">
              Instalar En Navalcarnero
            </h3>
            <p className="font-serif-spectral text-sm text-tinta-apagada">
              Accede rápidamente a la app desde tu pantalla de inicio. Funciona offline.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-pardo transition-colors hover:text-terracota"
            aria-label="Descartar"
          >
            <MIcon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={handleDismiss} className="gz-boton-borde flex-1 hover:bg-papel">
            No ahora
          </button>
          <button type="button" onClick={handleInstall} className="gz-boton-tinta flex-1">
            Instalar
          </button>
        </div>
      </div>
    </div>
  )
}
