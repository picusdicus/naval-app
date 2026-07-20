import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import MIcon from '../MIcon.jsx'
import { marcarVisto, prefsLocales } from '../../lib/push.js'

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
 * Bandeja de avisos recibidos: el historial de notificaciones push, filtrado
 * por los temas del dispositivo (lo hace useAvisos). Al abrirse marca todo como
 * leído. Cada aviso enlaza a la página del evento y cierra la bandeja.
 */
export default function DialogoBandeja({ abierto, avisos, onCerrar, onLeidos }) {
  const dialogo = useRef(null)

  useEffect(() => {
    const elemento = dialogo.current
    if (!elemento) return
    if (abierto && !elemento.open) {
      elemento.showModal()
      // Abrir la bandeja = leerla: marca el instante y baja el badge a 0.
      marcarVisto()
      onLeidos?.()
    }
    if (!abierto && elemento.open) elemento.close()
  }, [abierto, onLeidos])

  const suscrito = Boolean(prefsLocales())

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
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high"
          aria-label="Cerrar"
        >
          <MIcon name="close" className="text-[22px]" />
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto p-2">
        {avisos.length === 0 ? (
          <p className="p-8 text-center text-sm text-on-surface-variant">
            No hay avisos por ahora. Cuando se publiquen eventos que coincidan con lo que sigues,
            aparecerán aquí.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {avisos.map((a) => (
              <li key={a.referencia_id}>
                <Link
                  to={a.url}
                  onClick={onCerrar}
                  className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-surface-container-high"
                >
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-container">
                    <MIcon name="event" className="text-[18px] text-on-primary-container" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-on-surface">{a.titulo}</p>
                    {a.cuerpo && (
                      <p className="truncate text-sm text-on-surface-variant">{a.cuerpo}</p>
                    )}
                    <p className="mt-0.5 text-xs text-on-surface-variant/70">{cuandoLlego(a.enviado_en)}</p>
                  </div>
                  <MIcon name="chevron_right" className="mt-2 text-[20px] text-on-surface-variant/50" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!suscrito && avisos.length > 0 && (
        <p className="border-t border-outline-variant/20 px-4 py-3 text-xs text-on-surface-variant">
          Estás viendo todas las novedades. Activa los avisos para recibirlas en el móvil y
          filtrarlas por lo que te interesa.
        </p>
      )}
    </dialog>
  )
}
