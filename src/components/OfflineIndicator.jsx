import { useState, useEffect } from 'react'
import MIcon from './MIcon'

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="fixed top-16 left-0 right-0 z-30 bg-error/10 border-b border-error/20 px-4 py-3 md:top-20">
      <div className="mx-auto w-full max-w-[1440px] flex items-center gap-3">
        <MIcon name="wifi_off" className="text-error text-[20px] flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-error">Sin conexión a internet</p>
          <p className="text-xs text-error/80">
            Mostrando contenido guardado. Algunos datos podrían estar desactualizados.
          </p>
        </div>
      </div>
    </div>
  )
}
