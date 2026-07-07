import { Link } from 'react-router-dom'

// Pie de página oscuro (solo escritorio), según la referencia de desktop.
export default function Footer() {
  return (
    <footer className="hidden bg-inverse-surface text-inverse-on-surface md:block">
      <div className="mx-auto grid w-full max-w-[1140px] grid-cols-3 gap-10 px-10 py-12">
        <div>
          <p className="font-display text-lg font-bold text-secondary-container">Navalcarnero</p>
          <p className="mt-2 text-sm opacity-80">
            Tu conexión directa con los servicios municipales y la vida vecinal.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Link to="/eventos" className="opacity-80 hover:opacity-100 hover:underline">
            Eventos
          </Link>
          <Link to="/mapa" className="opacity-80 hover:opacity-100 hover:underline">
            Guía local
          </Link>
          <Link to="/transporte" className="opacity-80 hover:opacity-100 hover:underline">
            Transporte
          </Link>
          <Link to="/noticias" className="opacity-80 hover:opacity-100 hover:underline">
            Noticias
          </Link>
          <Link to="/asistente" className="opacity-80 hover:opacity-100 hover:underline">
            Asistente IA
          </Link>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-secondary-container">Atención ciudadana</p>
          <p className="mt-3 opacity-80">91 810 11 41 · 91 811 51 91</p>
          <p className="mt-1 opacity-80">Plaza de Segovia, 1</p>
          <p className="mt-1 opacity-80">L–V, 9:00 a 14:00</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs opacity-60">
        Proyecto vecinal no oficial · Datos de OpenStreetMap y fuentes locales
      </div>
    </footer>
  )
}
