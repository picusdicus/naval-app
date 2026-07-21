import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MIcon from './MIcon'

// Banner informativo de cookies (técnicas, no requieren consentimiento previo).
// Se muestra hasta que el vecino pulsa "Entendido"; la decisión se guarda en
// localStorage, así que no vuelve a aparecer en visitas posteriores (persiste
// entre sesiones, a diferencia de sessionStorage).
export default function CookieBanner() {
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    // Solo mostrar si no se ha aceptado nunca en este dispositivo.
    const yaVisto = localStorage.getItem('ncv_cookie_banner_cerrado')
    if (!yaVisto) {
      setMostrar(true)
    }
  }, [])

  const handleCerrar = () => {
    localStorage.setItem('ncv_cookie_banner_cerrado', 'true')
    setMostrar(false)
  }

  if (!mostrar) return null

  return (
    <div className="fixed bottom-24 left-3 right-3 z-40 border border-tinta bg-papel-calido md:bottom-4 md:left-4 md:right-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6 md:py-5">
        <div className="flex flex-1 items-start gap-3">
          <MIcon name="cookies" className="mt-0.5 flex-shrink-0 text-[20px] text-terracota" />
          <div className="font-serif-spectral text-sm text-tinta-apagada">
            <p className="mb-1 font-serif-dm text-lg leading-tight text-tinta">Usamos cookies técnicas</p>
            <p>
              Las cookies de sesión son estrictamente necesarias para que la app funcione. No
              usamos cookies de publicidad ni rastreo.{' '}
              <Link to="/cookies" className="font-semibold text-terracota hover:underline">
                Más información
              </Link>
            </p>
          </div>
        </div>
        <button type="button" onClick={handleCerrar} className="gz-boton-tinta flex-shrink-0">
          Entendido
        </button>
      </div>
    </div>
  )
}
