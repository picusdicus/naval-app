import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import MIcon from '../components/MIcon.jsx'
import Logo from '../components/Logo.jsx'
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
    <div className="flex min-h-screen items-center justify-center bg-papel-lienzo px-4 py-10">
      <div className="w-full max-w-md">
        <div className="overflow-hidden border border-tinta bg-papel shadow-cartel">
          <div className="h-2 bg-tinta-intensa" />
          <div className="p-6 sm:p-10">
          <div className="mb-5 flex flex-col items-center gap-3 text-center">
            <Logo tamano="lg" />
            <MIcon name="app_registration" className="text-[22px] text-terracota" />
          </div>

          <h1 className="text-center font-serif-dm text-3xl text-tinta">
            Registro de organización
          </h1>
          <p className="mb-7 mt-1 text-center font-serif-spectral text-sm text-pardo">
            Introduce tu código de invitación para crear tu cuenta
          </p>

          <form onSubmit={enviar} className="space-y-4" noValidate>
            <div>
              <label htmlFor="codigo" className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
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
                className="gz-input"
                disabled={enviando}
              />
            </div>

            <div>
              <label htmlFor="nombre" className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
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
                className="gz-input"
                disabled={enviando}
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
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
                className="gz-input"
                disabled={enviando}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
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
                className="gz-input"
                disabled={enviando}
              />
            </div>

            <div>
              <label htmlFor="confirmar" className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
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
                className="gz-input"
                disabled={enviando}
              />
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
              disabled={enviando || !codigo.trim() || !email.trim() || !nombre.trim() || !password.trim() || !confirmar.trim()}
              className="gz-boton-tinta w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? 'Registrando…' : 'Registrarse'}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-2 border border-filete bg-papel-calido p-3">
            <MIcon name="info" className="flex-shrink-0 text-[20px] text-pardo" />
            <p className="font-serif-spectral text-xs text-pardo">
              ¿Ya tienes cuenta?{' '}
              <a href="/login" className="font-semibold text-terracota hover:underline">
                Accede aquí
              </a>
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
