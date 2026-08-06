import { useState } from 'react'
import MIcon from '../MIcon.jsx'
import { useRecaptcha } from '../../lib/useRecaptcha.js'

export default function DialogoReclamarComercio({ abierto, comercioId, comercioNombre, onCerrar }) {
  const { getToken, cargando: captchaCargando } = useRecaptcha()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [solicitudId, setSolicitudId] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    setError('')

    if (!nombre.trim() || !email.trim() || !mensaje.trim()) {
      setError('Completa los campos requeridos.')
      return
    }

    setEnviando(true)

    try {
      const token = await getToken('sugerir_comercio')
      if (!token) throw new Error('No se pudo obtener el token reCAPTCHA')

      const respuesta = await fetch('/api/solicitar-reclamacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comercioId,
          nombre: nombre.trim(),
          email: email.trim(),
          telefono: telefono.trim() || null,
          mensaje: mensaje.trim(),
          recaptchaToken: token,
        }),
      })

      const datos = await respuesta.json()
      console.log('Respuesta del servidor:', { status: respuesta.status, ok: respuesta.ok, datos })

      if (!respuesta.ok) {
        throw new Error(datos.error || `Error ${respuesta.status}: No se pudo enviar la solicitud`)
      }

      if (!datos.ok) {
        throw new Error(datos.error || 'La solicitud no se procesó correctamente')
      }

      setSolicitudId(datos.solicitudId)
      setExito(true)
      setTimeout(() => {
        onCerrar()
        setExito(false)
        setNombre('')
        setEmail('')
        setTelefono('')
        setMensaje('')
        setSolicitudId('')
      }, 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden border border-tinta bg-papel shadow-cartel">
        <div className="h-2 bg-tinta-intensa" />
        <div className="p-6 sm:p-8">
          <button
            onClick={onCerrar}
            className="absolute right-4 top-4 text-pardo hover:text-tinta"
          >
            <MIcon name="close" className="text-[24px]" />
          </button>

          <h2 className="mb-2 font-serif-dm text-2xl text-tinta">Reclamar comercio</h2>
          <p className="mb-6 font-serif-spectral text-sm text-pardo">
            {comercioNombre ? `¿Es tu negocio "${comercioNombre}"?` : 'Verifica que eres el dueño del comercio'}
          </p>

          {exito ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <MIcon name="check_circle" className="text-[48px] text-verde" />
              <p className="font-serif-dm text-lg text-verde">¡Solicitud enviada!</p>
              <p className="font-serif-spectral text-sm text-pardo">
                Nos pondremos en contacto en breve para verificar tu identidad.
              </p>
              {solicitudId && (
                <div className="mt-4 w-full break-all rounded border border-verde/30 bg-verde/5 p-3">
                  <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">ID de Solicitud</p>
                  <p className="font-mono-ibm text-xs text-verde">{solicitudId}</p>
                  <p className="font-serif-spectral text-[11px] text-pardo">
                    Guarda este código para hacer seguimiento de tu solicitud
                  </p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-4" noValidate>
              <div>
                <label htmlFor="nombre" className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                  Tu nombre completo *
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Juan García López"
                  className="gz-input"
                  disabled={enviando}
                  maxLength={100}
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                  Email *
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="gz-input"
                  disabled={enviando}
                  maxLength={254}
                />
              </div>

              <div>
                <label htmlFor="telefono" className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                  Teléfono (opcional)
                </label>
                <input
                  id="telefono"
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+34 612 345 678"
                  className="gz-input"
                  disabled={enviando}
                  maxLength={20}
                />
              </div>

              <div>
                <label htmlFor="mensaje" className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                  ¿Por qué eres el dueño? *
                </label>
                <textarea
                  id="mensaje"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="Ej. Indicia tu NIF, web oficial, o cualquier dato que confirme tu titularidad"
                  className="gz-input h-20 resize-none"
                  disabled={enviando}
                  maxLength={500}
                />
                <p className="mt-1 text-right font-mono-ibm text-[10px] text-pardo">
                  {mensaje.length} / 500
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 border border-terracota/30 bg-terracota-fondo p-3">
                  <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-terracota" />
                  <p className="font-serif-spectral text-sm text-terracota">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCerrar}
                  disabled={enviando}
                  className="flex-1 border border-filete px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo transition-colors hover:enabled:text-tinta"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando || captchaCargando || !nombre.trim() || !email.trim() || !mensaje.trim()}
                  className="gz-boton-tinta flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enviando ? 'Enviando…' : 'Enviar solicitud'}
                </button>
              </div>

              <p className="text-center font-serif-spectral text-[11px] text-pardo">
                Protegido por reCAPTCHA
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
