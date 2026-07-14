import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import MIcon from '../components/MIcon.jsx'
import { useAdminAuth } from '../lib/adminAuth.jsx'

export default function Registro() {
  const { usuario, cargando } = useAdminAuth()
  const navegar = useNavigate()

  const [codigo, setCodigo] = useState('')
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Ya autenticado: ir al panel.
  if (!cargando && usuario) return <Navigate to="/panel" replace />

  const enviar = async (e) => {
    e.preventDefault()
    setError('')

    // Validaciones básicas.
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setEnviando(true)
    try {
      const respuesta = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: codigo.trim(),
          email: email.trim(),
          nombre: nombre.trim(),
          password,
        }),
      })

      const datos = await respuesta.json().catch(() => ({}))

      if (!respuesta.ok) {
        setError(datos.error || 'No se pudo completar el registro.')
        return
      }

      // Registro exitoso: ir al panel.
      navegar('/panel', { replace: true })
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.')
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
              <MIcon name="app_registration" className="text-[32px] text-on-primary" />
            </div>
          </div>

          <h1 className="mb-2 text-center font-display text-2xl font-bold text-primary">
            Registro de organización
          </h1>
          <p className="mb-8 text-center text-sm text-on-surface/70">
            Introduce tu código de invitación para crear tu cuenta
          </p>

          <form onSubmit={enviar} className="space-y-4" noValidate>
            <div>
              <label htmlFor="codigo" className="mb-2 block text-sm font-semibold text-on-surface">
                Código de invitación
              </label>
              <input
                id="codigo"
                type="text"
                autoCapitalize="characters"
                spellCheck="false"
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value.toUpperCase())
                  setError('')
                }}
                placeholder="EJEMPLO-1234"
                className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-base text-on-surface transition-all placeholder:text-on-surface/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={enviando}
              />
            </div>

            <div>
              <label htmlFor="nombre" className="mb-2 block text-sm font-semibold text-on-surface">
                Nombre completo
              </label>
              <input
                id="nombre"
                type="text"
                autoComplete="name"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value)
                  setError('')
                }}
                placeholder="Tu nombre"
                className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-base text-on-surface transition-all placeholder:text-on-surface/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={enviando}
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-on-surface">
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-base text-on-surface transition-all placeholder:text-on-surface/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={enviando}
              />
            </div>

            <div>
              <label htmlFor="confirmar" className="mb-2 block text-sm font-semibold text-on-surface">
                Confirmar contraseña
              </label>
              <input
                id="confirmar"
                type="password"
                autoComplete="new-password"
                value={confirmar}
                onChange={(e) => {
                  setConfirmar(e.target.value)
                  setError('')
                }}
                placeholder="Repite tu contraseña"
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
              disabled={enviando || !codigo.trim() || !email.trim() || !nombre.trim() || !password.trim() || !confirmar.trim()}
              className="w-full rounded-lg bg-primary py-3 font-semibold text-on-primary transition-all hover:enabled:shadow-card-lg active:enabled:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? 'Registrando…' : 'Registrarse'}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3">
            <MIcon name="info" className="flex-shrink-0 text-[20px] text-on-surface/60" />
            <p className="text-xs text-on-surface/60">
              ¿Ya tienes cuenta? <a href="/login" className="font-semibold text-primary hover:underline">Accede aquí</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
