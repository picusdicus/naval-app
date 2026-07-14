import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import MIcon from '../MIcon.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'

/**
 * Formulario de email + contraseña compartido por los dos puntos de entrada
 * del panel de gestión: /login (organizaciones, api/login.js) y /admin
 * (superadmin, api/admin/login.js). Cada uno pasa su propio endpoint, copy y
 * destino tras iniciar sesión.
 */
export default function FormularioLogin({ titulo, subtitulo, icono, endpoint, destinoDefecto, pie }) {
  const { usuario, cargando, iniciarSesion } = useAdminAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const destino = ubicacion.state?.desde || destinoDefecto

  // Ya autenticado: nada que hacer en el login.
  if (!cargando && usuario) return <Navigate to={destino} replace />

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await iniciarSesion(email, password, endpoint)
      navegar(destino, { replace: true })
    } catch (err) {
      setError(err.message)
      setPassword('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-surface-container-low to-surface-container-high px-4 py-10">
      <div className="w-full max-w-md">
        <div className="nv-card p-6 sm:p-8">
          <div className="mb-8 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container">
              <MIcon name={icono} className="text-[32px] text-on-primary" />
            </div>
          </div>

          <h1 className="mb-2 text-center font-display text-2xl font-bold text-primary">
            {titulo}
          </h1>
          <p className="mb-8 text-center text-sm text-on-surface/70">{subtitulo}</p>

          <form onSubmit={enviar} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-on-surface">
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                placeholder="tu@organizacion.org"
                className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-base text-on-surface transition-all placeholder:text-on-surface/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={enviando}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-on-surface">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                placeholder="••••••••"
                className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-base text-on-surface transition-all placeholder:text-on-surface/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={enviando}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 p-3"
              >
                <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-error" />
                <p className="text-sm font-medium text-error">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={enviando || !email.trim() || !password.trim()}
              className="w-full rounded-lg bg-primary py-3 font-semibold text-on-primary transition-all hover:enabled:shadow-card-lg active:enabled:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? 'Accediendo…' : 'Acceder'}
            </button>
          </form>
        </div>

        {pie && <div className="mx-auto mt-6 max-w-xs space-y-2 text-center text-xs text-on-surface/50">{pie}</div>}
      </div>
    </div>
  )
}
