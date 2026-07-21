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
    <div className="fixed left-0 right-0 top-16 z-30 border-b border-terracota/30 bg-terracota-fondo px-4 py-3 md:top-20">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3">
        <MIcon name="wifi_off" className="flex-shrink-0 text-[20px] text-terracota" />
        <div className="flex-1">
          <p className="font-serif-spectral text-sm font-semibold text-terracota">Sin conexión a internet</p>
          <p className="font-serif-spectral text-xs text-terracota/80">
            Mostrando contenido guardado. Algunos datos podrían estar desactualizados.
          </p>
        </div>
      </div>
    </div>
  )
}
