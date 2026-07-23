import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import MIcon from '../MIcon.jsx'

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
 * del dispositivo (lo hace useAvisos; sin suscripción llega vacía a propósito).
 * Distingue leídos de no leídos, permite marcar (una / todas) y borrar (una /
 * todas) en este dispositivo, y da acceso a la gestión de suscripción con el
 * icono de ajustes. NO marca nada como leído al abrirse: el estado de lectura
 * es explícito.
 */
export default function DialogoBandeja({
  abierto,
  avisos,
  suscrito,
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

  const hayNoLeidos = avisos.some((a) => !a.leido)

  return (
    <dialog
      ref={dialogo}
      onCancel={(e) => {
        e.preventDefault()
        onCerrar()
      }}
      className="w-full max-w-md border border-tinta bg-papel p-0 shadow-cartel backdrop:bg-tinta/40"
    >
      <div className="flex items-center justify-between border-b border-filete p-4">
        <h2 className="flex items-center gap-2 font-serif-dm text-xl text-tinta">
          <MIcon name="notifications" className="text-[20px] text-terracota" />
          Tus avisos
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onGestionar}
            className="p-2 text-pardo transition-colors hover:text-terracota"
            aria-label="Gestionar avisos"
            title="Gestionar avisos"
          >
            <MIcon name="settings" className="text-[20px]" />
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 text-pardo transition-colors hover:text-terracota"
            aria-label="Cerrar"
          >
            <MIcon name="close" className="text-[20px]" />
          </button>
        </div>
      </div>

      {/* Acciones globales */}
      {avisos.length > 0 && (
        <div className="flex items-center gap-2 border-b border-filete px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta">
          <button
            type="button"
            onClick={onMarcarTodasLeidas}
            disabled={!hayNoLeidos}
            className="flex items-center gap-1 px-2 py-1.5 text-pardo transition-colors hover:enabled:text-tinta disabled:opacity-40"
          >
            <MIcon name="done_all" className="text-[15px]" />
            Marcar todas como leídas
          </button>
          <button
            type="button"
            onClick={onBorrarTodas}
            className="ml-auto flex items-center gap-1 px-2 py-1.5 text-terracota transition-opacity hover:opacity-80"
          >
            <MIcon name="delete_sweep" className="text-[15px]" />
            Borrar todas
          </button>
        </div>
      )}

      <div className="max-h-[60vh] overflow-y-auto p-2">
        {avisos.length === 0 ? (
          <div className="p-8 text-center">
            {suscrito ? (
              <p className="font-serif-spectral text-sm text-pardo">
                No hay avisos por ahora. Cuando se publiquen eventos que coincidan con lo que
                sigues, aparecerán aquí.
              </p>
            ) : (
              <>
                <MIcon name="notifications_off" className="text-[32px] text-mudo" />
                <p className="mt-3 font-serif-spectral text-sm text-pardo">
                  Los avisos están desactivados en este dispositivo. Actívalos y aquí verás las
                  novedades de la agenda que te interesan.
                </p>
                <button type="button" onClick={onGestionar} className="gz-boton-tinta mt-4">
                  Activar avisos
                </button>
              </>
            )}
          </div>
        ) : (
          <ul className="flex flex-col">
            {avisos.map((a) => (
              <li
                key={a.referencia_id}
                className={`flex items-start gap-1 border-b border-filete last:border-b-0 ${
                  a.leido ? '' : 'bg-papel-calido'
                }`}
              >
                <Link
                  to={a.url}
                  onClick={() => {
                    onMarcarLeido(a.referencia_id)
                    onCerrar()
                  }}
                  className="flex min-w-0 flex-1 items-start gap-3 p-3 transition-colors hover:bg-papel-calido/60"
                >
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                      a.leido ? 'bg-transparent' : 'bg-terracota'
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        a.leido
                          ? 'font-serif-spectral text-tinta-apagada'
                          : 'font-serif-spectral font-semibold text-tinta'
                      }
                    >
                      {a.titulo}
                    </p>
                    {a.cuerpo && (
                      <p className="truncate font-serif-spectral text-sm text-pardo">{a.cuerpo}</p>
                    )}
                    <p className="mt-0.5 font-mono-ibm text-[10px] text-mudo">
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
                    className="p-1.5 text-pardo transition-colors hover:text-tinta"
                    aria-label={a.leido ? 'Marcar como no leída' : 'Marcar como leída'}
                    title={a.leido ? 'Marcar como no leída' : 'Marcar como leída'}
                  >
                    <MIcon name={a.leido ? 'mark_email_unread' : 'done'} className="text-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBorrar(a.referencia_id)}
                    className="p-1.5 text-pardo transition-colors hover:text-terracota"
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

    </dialog>
  )
}
