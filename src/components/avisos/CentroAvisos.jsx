import { useState } from 'react'
import MIcon from '../MIcon.jsx'
import { useAvisos } from '../../lib/useAvisos.js'
import DialogoBandeja from './DialogoBandeja.jsx'
import DialogoAvisos from '../eventos/DialogoAvisos.jsx'

/**
 * Centro de notificaciones de la cabecera: la campana (con contador de no
 * leídos) que abre la bandeja de avisos, más el diálogo de gestión de la
 * suscripción (al que se llega desde el icono de ajustes de la bandeja).
 * Autónomo: se monta en el Header y está disponible en todas las páginas
 * públicas. `variante` ajusta el color del icono al tema de cada barra.
 */
export default function CentroAvisos({ variante = 'primary' }) {
  const [bandeja, setBandeja] = useState(false)
  const [gestion, setGestion] = useState(false)
  const {
    avisos,
    noLeidos,
    marcarLeido,
    marcarNoLeido,
    marcarTodasLeidas,
    borrar,
    borrarTodas,
  } = useAvisos()

  const colorIcono = variante === 'primary' ? 'text-tinta' : 'text-pardo'

  return (
    <>
      <button
        type="button"
        onClick={() => setBandeja(true)}
        className={`relative p-2 transition-colors hover:text-terracota active:scale-95 ${colorIcono}`}
        aria-label={noLeidos > 0 ? `Tus avisos (${noLeidos} sin leer)` : 'Tus avisos'}
        title="Tus avisos"
      >
        <MIcon name="notifications" className="text-[22px]" />
        {noLeidos > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracota px-1 font-mono-ibm text-[10px] font-bold text-papel">
            {noLeidos > 9 ? '9+' : noLeidos}
          </span>
        )}
      </button>

      <DialogoBandeja
        abierto={bandeja}
        avisos={avisos}
        onCerrar={() => setBandeja(false)}
        onGestionar={() => {
          setBandeja(false)
          setGestion(true)
        }}
        onMarcarLeido={marcarLeido}
        onMarcarNoLeido={marcarNoLeido}
        onMarcarTodasLeidas={marcarTodasLeidas}
        onBorrar={borrar}
        onBorrarTodas={borrarTodas}
      />

      <DialogoAvisos abierto={gestion} onCerrar={() => setGestion(false)} />
    </>
  )
}
