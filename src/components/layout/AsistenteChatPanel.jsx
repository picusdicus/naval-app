import MIcon from '../MIcon.jsx'
import AsistenteChat from '../asistente/AsistenteChat.jsx'

// Panel del asistente para escritorio: se desliza desde la derecha sobre la
// página actual (no navega), así el vecino no pierde el contexto de lo que
// estaba viendo. En móvil el asistente sigue siendo la página /asistente
// (NavBar, MenuDrawer): este panel se oculta con "hidden md:flex".
export default function AsistenteChatPanel({ abierto, onCerrar }) {
  return (
    <div
      className={`fixed inset-0 z-50 hidden transition-opacity duration-300 md:flex ${
        abierto ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!abierto}
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-tinta/40" onClick={onCerrar} />

      {/* Panel */}
      <aside
        className={`relative ml-auto flex h-full w-full max-w-md transform flex-col border-l-2 border-tinta bg-papel p-4 transition-transform duration-300 ease-out ${
          abierto ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="mb-4 flex items-center justify-between border-b border-filete pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-tinta text-oro">
              <MIcon name="smart_toy" className="text-[22px]" />
            </div>
            <div>
              <h2 className="font-serif-dm text-lg leading-tight text-tinta">PuebloGPT</h2>
              <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
                Asistente vecinal de Navalcarnero
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar asistente"
            className="p-2 text-pardo transition-colors hover:text-terracota"
          >
            <MIcon name="close" />
          </button>
        </div>

        <AsistenteChat />
      </aside>
    </div>
  )
}
