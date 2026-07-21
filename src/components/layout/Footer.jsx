import { Link } from 'react-router-dom'

// Pie de página (solo escritorio), estética La Gaceta: papel con filete doble,
// marca en DM Serif, etiquetas mono. El público-móvil usa el NavBar inferior.
export default function Footer({ onAbrirChat }) {
  return (
    <footer className="hidden bg-papel md:block">
      <div className="mx-auto w-full max-w-[1440px] px-10">
        <div className="gz-filete-doble" />
        <div className="grid grid-cols-3 gap-10 py-12">
          <div>
            <p className="font-serif-dm text-xl text-tinta">En Navalcarnero</p>
            <p className="mt-2 font-serif-spectral text-sm text-pardo">
              Tu conexión directa con los servicios municipales y la vida vecinal.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-serif-spectral text-sm text-pardo">
            <Link to="/eventos" className="transition-colors hover:text-terracota">
              Eventos
            </Link>
            <Link to="/comercios" className="transition-colors hover:text-terracota">
              Comercios
            </Link>
            <Link to="/noticias" className="transition-colors hover:text-terracota">
              Noticias
            </Link>
            <button
              type="button"
              onClick={onAbrirChat}
              className="text-left transition-colors hover:text-terracota"
            >
              Asistente IA
            </button>
          </div>
          <div className="font-serif-spectral text-sm text-pardo">
            <p className="gz-label text-mudo">Atención ciudadana</p>
            <p className="mt-3">91 810 11 41 · 91 811 51 91</p>
            <p className="mt-1">Plaza de Segovia, 1</p>
            <p className="mt-1">L–V, 9:00 a 14:00</p>
          </div>
        </div>
        <div className="border-t border-filete py-5 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
          <p>Proyecto vecinal no oficial · Datos de OpenStreetMap y fuentes locales</p>
          <p className="mt-2 normal-case tracking-normal">
            <Link to="/aviso-legal" className="hover:text-terracota">
              Aviso legal
            </Link>
            {' · '}
            <Link to="/privacidad" className="hover:text-terracota">
              Privacidad
            </Link>
            {' · '}
            <Link to="/cookies" className="hover:text-terracota">
              Cookies
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
