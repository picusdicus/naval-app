import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MIcon from './MIcon'

// Banner informativo de cookies (técnicas, no requieren consentimiento previo).
// Se muestra una sola vez por sesión, se puede cerrar, y guarda la decisión en
// localStorage para no volver a molestarlo en esa sesión.
export default function CookieBanner() {
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    // Solo mostrar si no se ha cerrado en esta sesión
    const yaVisto = sessionStorage.getItem('ncv_cookie_banner_cerrado')
    if (!yaVisto) {
      setMostrar(true)
    }
  }, [])

  const handleCerrar = () => {
    sessionStorage.setItem('ncv_cookie_banner_cerrado', 'true')
    setMostrar(false)
  }

  if (!mostrar) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-highest border-t border-outline-variant/20 shadow-card-lg md:rounded-t-lg md:left-4 md:right-4 md:bottom-4">
      <div className="max-w-4xl mx-auto px-5 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <MIcon name="cookies" className="text-[20px] text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-on-surface/80">
            <p className="font-semibold text-on-surface mb-1">Usamos cookies técnicas</p>
            <p>
              Las cookies de sesión son estrictamente necesarias para que la app funcione. No
              usamos cookies de publicidad ni rastreo.{' '}
              <Link to="/cookies" className="text-primary font-semibold hover:underline">
                Más información
              </Link>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCerrar}
          className="flex-shrink-0 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 active:opacity-80"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
