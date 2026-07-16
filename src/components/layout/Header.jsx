import { Link, NavLink } from 'react-router-dom'
import MIcon from '../MIcon.jsx'

const enlaces = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/eventos', label: 'Eventos' },
  { to: '/comercios', label: 'Comercios' },
  { to: '/transporte', label: 'Transporte' },
  { to: '/noticias', label: 'Noticias' },
]

export default function Header({ onAbrirMenu, onAbrirChat, onLogout }) {
  return (
    <header className="sticky top-0 z-40 bg-background md:bg-surface md:shadow-card">
      {/* Barra móvil */}
      <div className="flex h-16 items-center justify-between px-5 md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAbrirMenu}
            aria-label="Abrir menú"
            className="rounded-full p-2 text-primary transition-colors hover:bg-surface-container active:scale-95"
          >
            <MIcon name="menu" />
          </button>
          <h1 className="font-display text-xl font-bold text-primary">Vecinal - Navalcarnero</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión"
            className="rounded-full p-2 text-primary transition-colors hover:bg-surface-container active:scale-95"
            title="Cerrar sesión"
          >
            <MIcon name="logout" />
          </button>
          <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-primary-fixed bg-surface-container-high">
            <img src="/logo.png" alt="Escudo de Vecinal - Navalcarnero" className="h-full w-full object-contain p-1" />
          </div>
        </div>
      </div>

      {/* Barra de escritorio */}
      <div className="mx-auto hidden w-full max-w-[1440px] items-center justify-between px-10 py-4 md:flex">
        <Link to="/" className="font-display text-xl font-extrabold text-primary">
          Vecinal - Navalcarnero
        </Link>
        <div className="flex items-center gap-8">
          {enlaces.map((e) => (
            <NavLink
              key={e.to}
              to={e.to}
              end={e.end}
              className={({ isActive }) =>
                isActive
                  ? 'border-b-2 border-primary pb-1 text-sm font-semibold text-primary'
                  : 'rounded-lg px-2 py-1 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary'
              }
            >
              {e.label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onAbrirChat}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-on-primary transition-all duration-200 ease-in-out hover:bg-primary-container active:scale-95"
          >
            Asistente IA
          </button>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary active:scale-95"
            title="Cerrar sesión"
          >
            <MIcon name="logout" />
          </button>
        </div>
      </div>
    </header>
  )
}
