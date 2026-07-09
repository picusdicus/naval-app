import { useState, useEffect } from 'react'
import MIcon from './MIcon'

export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    // Si ya fue descartado en esta sesión, no mostrar
    if (sessionStorage.getItem('install-dismissed')) {
      return
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShow(false)
        sessionStorage.setItem('install-dismissed', 'true')
      }
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShow(false)
    sessionStorage.setItem('install-dismissed', 'true')
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 z-40 lg:bottom-6 lg:right-6 lg:w-auto lg:max-w-sm animate-in slide-in-from-bottom duration-300">
      <div className="nv-card p-4 shadow-card-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 pt-0.5">
            <MIcon name="mobile_screen_share" className="text-primary text-[24px]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-primary mb-1">Instalar Vecinal</h3>
            <p className="text-sm text-on-surface-variant">
              Accede rápidamente a la app desde tu pantalla de inicio. Funciona offline.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-shrink-0 rounded-full p-1 text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Descartar"
          >
            <MIcon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            No ahora
          </button>
          <button
            type="button"
            onClick={handleInstall}
            className="flex-1 px-3 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:shadow-card-lg transition-all active:scale-95"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  )
}
