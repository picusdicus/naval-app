import { NavLink } from 'react-router-dom'
import { IconHome, IconCalendar, IconMap, IconBus, IconSparkles } from '../icons.jsx'

const tabs = [
  { to: '/', label: 'Inicio', Icon: IconHome, end: true },
  { to: '/eventos', label: 'Eventos', Icon: IconCalendar },
  { to: '/mapa', label: 'Guía', Icon: IconMap },
  { to: '/transporte', label: 'Transporte', Icon: IconBus },
  { to: '/asistente', label: 'Asistente', Icon: IconSparkles },
]

export default function NavBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-crema-dark bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 pb-3 pt-2">
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="flex flex-col items-center gap-1">
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-8 w-11 items-center justify-center rounded-full transition-colors ${
                    isActive ? 'bg-vino' : ''
                  }`}
                >
                  <Icon className={`h-[19px] w-[19px] ${isActive ? 'text-oro' : 'text-tinta-muted'}`} />
                </span>
                <span
                  className={`text-[10px] ${isActive ? 'font-semibold text-vino' : 'text-tinta-muted'}`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
