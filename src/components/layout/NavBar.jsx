import { NavLink } from 'react-router-dom'
import MIcon from '../MIcon.jsx'

const tabs = [
  { to: '/', label: 'Inicio', icono: 'home', end: true },
  { to: '/eventos', label: 'Eventos', icono: 'calendar_today' },
  { to: '/mapa', label: 'Guía', icono: 'explore' },
  { to: '/noticias', label: 'Noticias', icono: 'newspaper' },
  { to: '/asistente', label: 'IA', icono: 'smart_toy' },
]

// Barra de navegación inferior (solo móvil), según la referencia: pestaña
// activa como píldora verde salvia sobre superficie blanca redondeada arriba.
export default function NavBar() {
  return (
    <nav className="fixed bottom-0 z-40 flex w-full items-center justify-around rounded-t-xl bg-surface-container-lowest px-2 py-3 shadow-card-up md:hidden">
      {tabs.map(({ to, label, icono, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            isActive
              ? 'flex scale-90 transform flex-col items-center justify-center rounded-full bg-secondary-container px-4 py-1 text-on-secondary-container transition-transform'
              : 'flex flex-col items-center justify-center px-4 py-1 text-on-surface-variant transition-colors hover:text-primary'
          }
        >
          <MIcon name={icono} />
          <span className="text-xs font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
