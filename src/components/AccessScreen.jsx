import { useState, useEffect } from 'react'
import MIcon from './MIcon'

const SESSION_KEY = 'ncv_access'

export default function AccessScreen({ onAccessGranted }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY)
    if (savedSession) {
      onAccessGranted()
    }
  }, [onAccessGranted])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const correctPassword = import.meta.env.VITE_APP_PASSWORD

    if (password === correctPassword) {
      localStorage.setItem(SESSION_KEY, 'true')
      onAccessGranted()
    } else {
      setError('Contraseña incorrecta')
      setPassword('')
    }

    setIsLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-surface-container-low to-surface-container-high">
      <div className="w-full max-w-md px-6">
        <div className="nv-card p-8">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center">
              <MIcon name="location_city" className="text-primary text-[32px]" />
            </div>
          </div>

          <h1 className="font-display text-2xl font-bold text-center text-primary mb-2">
            Navalcarnero
          </h1>
          <p className="text-center text-on-surface/70 text-sm mb-8">
            Bienvenido al portal vecinal
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-on-surface mb-2">
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
                className="w-full px-4 py-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-on-surface placeholder-on-surface/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-error/10 border border-error/20">
                <MIcon name="error" className="text-error text-[20px] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-error font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="w-full py-3 rounded-lg bg-primary text-on-primary font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:shadow-card-lg active:enabled:scale-98"
            >
              {isLoading ? 'Verificando...' : 'Acceder'}
            </button>
          </form>
        </div>

        <p className="text-center text-on-surface/50 text-xs mt-6 max-w-xs mx-auto">
          Portal privado para vecinos de Navalcarnero. Se requiere contraseña para acceder.
        </p>
      </div>
    </div>
  )
}
