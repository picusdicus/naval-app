import { useState } from 'react'
import MIcon from '../MIcon.jsx'

export default function DialogoInfoUsuario({ abierto, usuario, ocupado, onCambiarPassword, onCerrar }) {
  const [modo, setModo] = useState('info')
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const limpiarFormulario = () => {
    setPasswordActual('')
    setPasswordNueva('')
    setPasswordConfirm('')
    setError('')
    setExito('')
    setModo('info')
  }

  const manejarCierre = () => {
    limpiarFormulario()
    onCerrar()
  }

  const validarYCambiar = async () => {
    setError('')
    setExito('')

    if (!passwordActual.trim()) {
      setError('Ingresa tu contraseña actual.')
      return
    }
    if (!passwordNueva.trim()) {
      setError('Ingresa la contraseña nueva.')
      return
    }
    if (passwordNueva.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (passwordNueva !== passwordConfirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (passwordActual === passwordNueva) {
      setError('La contraseña nueva debe ser diferente de la actual.')
      return
    }

    try {
      await onCambiarPassword({ passwordActual, passwordNueva })
      setExito('Contraseña cambiada exitosamente.')
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la contraseña.')
    }
  }

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md bg-papel">
        <div className="border-b border-filete px-6 py-4">
          <h2 className="font-serif-dm text-lg text-tinta">Información de usuario</h2>
        </div>

        <div className="p-6">
          {modo === 'info' && (
            <div className="space-y-4">
              <div>
                <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Email</p>
                <p className="mt-1 font-serif-spectral text-tinta">{usuario?.email || '—'}</p>
              </div>

              {usuario?.nombre && (
                <div>
                  <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                    Nombre
                  </p>
                  <p className="mt-1 font-serif-spectral text-tinta">{usuario.nombre}</p>
                </div>
              )}

              {usuario?.rol && (
                <div>
                  <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                    Rol
                  </p>
                  <p className="mt-1 font-serif-spectral text-tinta capitalize">
                    {usuario.rol === 'admin' ? 'Administrador' : usuario.rol === 'superadmin' ? 'Superadministrador' : usuario.rol}
                  </p>
                </div>
              )}

              {usuario?.organizacionSlug && usuario.rol !== 'superadmin' && (
                <div>
                  <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                    Organización
                  </p>
                  <p className="mt-1 font-serif-spectral text-tinta">{usuario.organizacionSlug}</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setModo('cambiar-password')}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 border border-tinta px-4 py-2.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-papel-calido"
              >
                <MIcon name="lock" className="text-[16px]" />
                Cambiar contraseña
              </button>
            </div>
          )}

          {modo === 'cambiar-password' && (
            <div className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 border border-terracota/30 bg-terracota-fondo p-3"
                >
                  <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[18px] text-terracota" />
                  <p className="font-serif-spectral text-sm text-terracota">{error}</p>
                </div>
              )}

              {exito && (
                <div
                  role="status"
                  className="flex items-start gap-2 border border-verde/30 bg-verde-fondo p-3"
                >
                  <MIcon name="check_circle" className="mt-0.5 flex-shrink-0 text-[18px] text-verde" />
                  <p className="font-serif-spectral text-sm text-verde">{exito}</p>
                </div>
              )}

              <div>
                <label htmlFor="password-actual" className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                  Contraseña actual
                </label>
                <input
                  id="password-actual"
                  type="password"
                  value={passwordActual}
                  onChange={(e) => setPasswordActual(e.target.value)}
                  disabled={ocupado}
                  className="mt-2 w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-tinta placeholder-pardo disabled:opacity-50"
                  placeholder="Ingresa tu contraseña actual"
                />
              </div>

              <div>
                <label htmlFor="password-nueva" className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                  Contraseña nueva
                </label>
                <input
                  id="password-nueva"
                  type="password"
                  value={passwordNueva}
                  onChange={(e) => setPasswordNueva(e.target.value)}
                  disabled={ocupado}
                  className="mt-2 w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-tinta placeholder-pardo disabled:opacity-50"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div>
                <label htmlFor="password-confirm" className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                  Confirmar contraseña
                </label>
                <input
                  id="password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  disabled={ocupado}
                  className="mt-2 w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-tinta placeholder-pardo disabled:opacity-50"
                  placeholder="Repite la contraseña nueva"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setModo('info')}
                  disabled={ocupado}
                  className="flex-1 border border-filete px-4 py-2.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo transition-colors hover:enabled:text-tinta disabled:opacity-50"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={validarYCambiar}
                  disabled={ocupado}
                  className="flex-1 bg-tinta px-4 py-2.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-papel transition-opacity hover:enabled:opacity-90 disabled:opacity-50"
                >
                  {ocupado ? 'Cambiando…' : 'Cambiar'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-filete px-6 py-3">
          <button
            type="button"
            onClick={manejarCierre}
            disabled={ocupado}
            className="w-full text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo transition-colors hover:enabled:text-tinta disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
