import { NavLink, useLocation } from 'react-router-dom'
import { IconCalendar, IconMap, IconNews, IconChat } from '../icons.jsx'

function IconHome(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9h12v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const tabs = [
  { to: '/', label: 'Inicio', Icon: IconHome, end: true },
  { to: '/eventos', label: 'Eventos', Icon: IconCalendar },
  { to: '/mapa', label: 'Mapa', Icon: IconMap },
  { to: '/noticias', label: 'Noticias', Icon: IconNews },
]

export default function NavBar() {
  const { pathname } = useLocation()
  const enAsistente = pathname === '/asistente'

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 md:hidden">
      {!enAsistente && (
        <NavLink
          to="/asistente"
          aria-label="Abrir asistente IA"
          className="absolute bottom-[54px] right-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-dorado shadow-lg shadow-black/20"
        >
          <IconChat className="h-6 w-6 text-vino-dark" />
        </NavLink>
      )}
      <nav className="flex items-center justify-around border-t border-tierra-dark/10 bg-white/95 py-2 backdrop-blur">
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium ${
                isActive ? 'text-vino' : 'text-tinta-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 ${isActive ? 'text-vino' : 'text-tinta-muted'}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
