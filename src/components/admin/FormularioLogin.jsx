import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import MIcon from '../MIcon.jsx'
import Logo from '../Logo.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'

/**
 * Formulario de email + contraseña compartido por los dos puntos de entrada
 * del panel de gestión: /login (organizaciones, api/login.js) y /admin
 * (superadmin, api/admin/login.js). Cada uno pasa su propio endpoint, copy y
 * destino tras iniciar sesión. Estética La Gaceta (ref. 5a): tarjeta con
 * franja superior de tinta, logo apilado y campos impresos.
 *
 * Contrato e2e: ids #email/#password, botón "Acceder", type="email".
 */
export default function FormularioLogin({ titulo, subtitulo, icono, endpoint, destinoDefecto, pie }) {
  const { usuario, cargando, iniciarSesion } = useAdminAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verContraseña, setVerContraseña] = useState(false)
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
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-papel-lienzo px-4 py-10">
      <div className="w-full max-w-md">
        <div className="overflow-hidden border border-tinta bg-papel shadow-cartel">
          <div className="h-2 bg-tinta-intensa" />
          <div className="p-6 sm:p-10">
            <div className="mb-5 flex flex-col items-center gap-3 text-center">
              <Logo tamano="lg" />
              <MIcon name={icono} className="text-[22px] text-terracota" />
            </div>

            <h1 className="text-center font-serif-dm text-3xl text-tinta">{titulo}</h1>
            <p className="mb-7 mt-1 text-center font-serif-spectral text-sm text-pardo">{subtitulo}</p>

            <form onSubmit={enviar} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo"
                >
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
                  className="gz-input"
                  disabled={enviando}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={verContraseña ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    placeholder="••••••••"
                    className="gz-input pr-10"
                    disabled={enviando}
                  />
                  <button
                    type="button"
                    onClick={() => setVerContraseña(!verContraseña)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-pardo transition-colors hover:text-tinta disabled:opacity-50"
                    disabled={enviando}
                    title={verContraseña ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <MIcon name={verContraseña ? 'visibility_off' : 'visibility'} className="text-[20px]" />
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 border border-terracota/30 bg-terracota-fondo p-3"
                >
                  <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-terracota" />
                  <p className="font-serif-spectral text-sm font-medium text-terracota">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={enviando || !email.trim() || !password.trim()}
                className="gz-boton-tinta w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? 'Accediendo…' : 'Acceder'}
              </button>
            </form>
          </div>
        </div>

        {pie && (
          <div className="mx-auto mt-6 max-w-xs space-y-2 text-center font-serif-spectral text-xs text-mudo">
            {pie}
          </div>
        )}
      </div>
    </div>
  )
}
