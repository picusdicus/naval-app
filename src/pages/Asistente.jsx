import MIcon from '../components/MIcon.jsx'
import AsistenteChat from '../components/asistente/AsistenteChat.jsx'

// Página completa del asistente: usada en móvil (pestaña "IA" / menú) y en
// escritorio si se navega directamente a /asistente. En escritorio, el punto
// de entrada habitual es el panel deslizante (ver AsistenteChatPanel).
export default function Asistente() {
  return (
    <div className="mx-auto flex h-[calc(100vh-190px)] max-w-3xl flex-col md:h-[calc(100vh-260px)]">
      {/* Cabecera del asistente */}
      <header className="mb-4 flex flex-col items-center text-center">
        <div className="mb-2 flex h-16 w-16 items-center justify-center bg-tinta text-oro">
          <MIcon name="smart_toy" className="text-[32px]" />
        </div>
        <h1 className="font-serif-dm text-2xl text-tinta">PuebloGPT</h1>
        <p className="mt-1 max-w-md font-serif-spectral text-sm text-pardo">
          Pregunta sobre trámites, horarios, eventos o comercios de Navalcarnero.
        </p>
      </header>

      <AsistenteChat />
    </div>
  )
}
