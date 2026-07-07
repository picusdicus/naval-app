import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Inicio' },
  { to: '/eventos', label: 'Eventos' },
  { to: '/mapa', label: 'Mapa' },
  { to: '/noticias', label: 'Noticias' },
  { to: '/transporte', label: 'Transporte' },
  { to: '/asistente', label: 'Asistente IA' },
]

export default function Header() {
  return (
    <header className="bg-vino text-crema">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-6">
        <NavLink to="/" className="font-display text-xl font-semibold tracking-wide">
          Navalcarnero
        </NavLink>
        <nav className="hidden gap-6 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? 'text-dorado' : 'text-crema/80 hover:text-crema'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
