import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import MIcon from '../MIcon.jsx'
import { prefsLocales } from '../../lib/push.js'

// Fecha/hora legible del momento en que se envió el aviso.
function cuandoLlego(iso) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

/**
 * Bandeja de avisos: historial de notificaciones push, filtrado por los temas
 * del dispositivo (lo hace useAvisos). Distingue leídos de no leídos, permite
 * marcar (una / todas) y borrar (una / todas) en este dispositivo, y da acceso
 * a la gestión de suscripción con el icono de ajustes. NO marca nada como leído
 * al abrirse: el estado de lectura es explícito.
 */
export default function DialogoBandeja({
  abierto,
  avisos,
  onCerrar,
  onGestionar,
  onMarcarLeido,
  onMarcarNoLeido,
  onMarcarTodasLeidas,
  onBorrar,
  onBorrarTodas,
}) {
  const dialogo = useRef(null)

  useEffect(() => {
    const elemento = dialogo.current
    if (!elemento) return
    if (abierto && !elemento.open) elemento.showModal()
    if (!abierto && elemento.open) elemento.close()
  }, [abierto])

  const suscrito = Boolean(prefsLocales())
  const hayNoLeidos = avisos.some((a) => !a.leido)

  return (
    <dialog
      ref={dialogo}
      onCancel={(e) => {
        e.preventDefault()
        onCerrar()
      }}
      className="w-full max-w-md rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-0 shadow-card-lg backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-outline-variant/20 p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-on-surface">
          <MIcon name="notifications" className="text-[22px] text-primary" />
          Tus avisos
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onGestionar}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
            aria-label="Gestionar avisos"
            title="Gestionar avisos"
          >
            <MIcon name="settings" className="text-[20px]" />
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
            aria-label="Cerrar"
          >
            <MIcon name="close" className="text-[20px]" />
          </button>
        </div>
      </div>

      {/* Acciones globales */}
      {avisos.length > 0 && (
        <div className="flex items-center gap-2 border-b border-outline-variant/20 px-3 py-2">
          <button
            type="button"
            onClick={onMarcarTodasLeidas}
            disabled={!hayNoLeidos}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:enabled:bg-surface-container-high disabled:opacity-40"
          >
            <MIcon name="done_all" className="text-[16px]" />
            Marcar todas como leídas
          </button>
          <button
            type="button"
            onClick={onBorrarTodas}
            className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-error transition-colors hover:bg-surface-container-high"
          >
            <MIcon name="delete_sweep" className="text-[16px]" />
            Borrar todas
          </button>
        </div>
      )}

      <div className="max-h-[60vh] overflow-y-auto p-2">
        {avisos.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-on-surface-variant">
              No hay avisos por ahora. Cuando se publiquen eventos que coincidan con lo que sigues,
              aparecerán aquí.
            </p>
            {!suscrito && (
              <button
                type="button"
                onClick={onGestionar}
                className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
              >
                Activar avisos
              </button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {avisos.map((a) => (
              <li
                key={a.referencia_id}
                className={`flex items-start gap-1 rounded-lg ${
                  a.leido ? '' : 'bg-primary-container/15'
                }`}
              >
                <Link
                  to={a.url}
                  onClick={() => {
                    onMarcarLeido(a.referencia_id)
                    onCerrar()
                  }}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-lg p-3 transition-colors hover:bg-surface-container-high"
                >
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                      a.leido ? 'bg-transparent' : 'bg-primary'
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        a.leido
                          ? 'font-medium text-on-surface-variant'
                          : 'font-semibold text-on-surface'
                      }
                    >
                      {a.titulo}
                    </p>
                    {a.cuerpo && (
                      <p className="truncate text-sm text-on-surface-variant">{a.cuerpo}</p>
                    )}
                    <p className="mt-0.5 text-xs text-on-surface-variant/70">
                      {cuandoLlego(a.enviado_en)}
                    </p>
                  </div>
                </Link>
                <div className="flex flex-shrink-0 flex-col gap-1 p-2">
                  <button
                    type="button"
                    onClick={() =>
                      a.leido ? onMarcarNoLeido(a.referencia_id) : onMarcarLeido(a.referencia_id)
                    }
                    className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                    aria-label={a.leido ? 'Marcar como no leída' : 'Marcar como leída'}
                    title={a.leido ? 'Marcar como no leída' : 'Marcar como leída'}
                  >
                    <MIcon
                      name={a.leido ? 'mark_email_unread' : 'done'}
                      className="text-[18px]"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBorrar(a.referencia_id)}
                    className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-error"
                    aria-label="Borrar aviso"
                    title="Borrar aviso"
                  >
                    <MIcon name="delete" className="text-[18px]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!suscrito && avisos.length > 0 && (
        <p className="border-t border-outline-variant/20 px-4 py-3 text-xs text-on-surface-variant">
          Estás viendo todas las novedades. Usa el icono de ajustes para activar los avisos en el
          móvil y filtrarlos por lo que te interesa.
        </p>
      )}
    </dialog>
  )
}
