import { useState } from 'react'
import { Link } from 'react-router-dom'
import MIcon from './MIcon'
import Logo from './Logo.jsx'

export default function AccessScreen({ onAccessGranted }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // La contraseña se verifica en el servidor: si es correcta, el endpoint
    // fija una cookie httpOnly firmada que el navegador no puede falsificar.
    try {
      const respuesta = await fetch('/api/acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (respuesta.ok) {
        onAccessGranted()
      } else {
        const datos = await respuesta.json().catch(() => ({}))
        setError(datos.error || 'Contraseña incorrecta')
        setPassword('')
      }
    } catch {
      setError('No se pudo verificar el acceso. Inténtalo de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-papel-lienzo px-6">
      <div className="w-full max-w-md">
        <div className="overflow-hidden border border-tinta bg-papel shadow-cartel">
          <div className="h-2 bg-tinta-intensa" />
          <div className="p-8 text-center">
            <div className="mb-6 flex justify-center">
              <Logo tamano="xl" />
            </div>

            <h1 className="font-serif-dm text-2xl text-tinta">Bienvenido al portal vecinal</h1>
            <p className="mt-1 font-serif-spectral text-sm text-pardo">
              Accede con la contraseña compartida
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4 text-left">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="Ingresa la contraseña"
                  className="gz-input"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 border border-terracota/30 bg-terracota-fondo p-3">
                  <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-terracota" />
                  <p className="font-serif-spectral text-sm font-medium text-terracota">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !password.trim()}
                className="gz-boton-tinta w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? 'Verificando...' : 'Acceder'}
              </button>
            </form>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-xs text-center font-serif-spectral text-xs text-mudo">
          Portal privado para vecinos de Navalcarnero. Se requiere contraseña para acceder.
        </p>

        <div className="mx-auto mt-4 max-w-xs space-x-2 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
          <Link to="/aviso-legal" className="hover:text-terracota hover:underline">
            Aviso legal
          </Link>
          <span>·</span>
          <Link to="/privacidad" className="hover:text-terracota hover:underline">
            Privacidad
          </Link>
        </div>
      </div>
    </div>
  )
}
