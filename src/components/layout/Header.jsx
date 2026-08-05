import { Link, NavLink } from 'react-router-dom'
import MIcon from '../MIcon.jsx'
import Logo from '../Logo.jsx'
import CentroAvisos from '../avisos/CentroAvisos.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'

// Transporte se oculta del menú de escritorio (sigue accesible desde el menú
// móvil, la NavBar inferior y su ruta directa /transporte).
const enlaces = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/eventos', label: 'Eventos' },
  { to: '/actividades', label: 'Actividades' },
  { to: '/comercios', label: 'Comercios' },
  { to: '/noticias', label: 'Noticias' },
]

export default function Header({ onAbrirMenu, onAbrirChat, onLogout }) {
  const { usuario, cargando } = useAdminAuth()

  return (
    <header className="sticky top-0 z-40 bg-papel lg:border-b lg:border-filete">
      {/* Barra móvil y tablet: la de escritorio no cabe por debajo de lg
          (logo + enlaces + acciones desbordan y el menú se rompe). */}
      <div className="flex h-16 items-center justify-between border-b border-filete px-5 lg:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAbrirMenu}
            aria-label="Abrir menú"
            className="p-1 text-tinta transition-transform active:scale-95"
          >
            <MIcon name="menu" className="text-[22px]" />
          </button>
          <Link to="/" aria-label="Inicio">
            <Logo tamano="sm" />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <CentroAvisos />
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión"
            className="p-2 text-tinta transition-transform hover:text-terracota active:scale-95"
            title="Cerrar sesión"
          >
            <MIcon name="logout" className="text-[22px]" />
          </button>
        </div>
      </div>

      {/* Barra de escritorio */}
      <div className="mx-auto hidden w-full max-w-[1440px] items-center justify-between px-10 py-4 lg:flex">
        <Link to="/" aria-label="Inicio">
          <Logo tamano="md" />
        </Link>
        <div className="flex items-center gap-8">
          {enlaces.map((e) => (
            <NavLink
              key={e.to}
              to={e.to}
              end={e.end}
              className={({ isActive }) =>
                isActive
                  ? 'border-b-2 border-terracota pb-1 font-serif-spectral text-base font-semibold text-tinta'
                  : 'font-serif-spectral text-base text-pardo transition-colors hover:text-terracota'
              }
            >
              {e.label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <CentroAvisos variante="neutral" />
          {!cargando &&
            (usuario ? (
              // Con sesión abierta el enlace lleva al panel que le toca al rol;
              // si no, no habría forma de volver a la gestión desde el portal.
              <Link
                to={usuario.rol === 'superadmin' ? '/admin' : '/panel'}
                className="font-serif-spectral text-base text-pardo transition-colors hover:text-terracota"
              >
                Mi panel
              </Link>
            ) : (
              <Link
                to="/login"
                className="font-serif-spectral text-base text-pardo transition-colors hover:text-terracota"
              >
                Login
              </Link>
            ))}
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión"
            className="p-2 text-pardo transition-colors hover:text-terracota active:scale-95"
            title="Cerrar sesión"
          >
            <MIcon name="logout" className="text-[22px]" />
          </button>
        </div>
      </div>
    </header>
  )
}
