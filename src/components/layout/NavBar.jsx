import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/eventos', label: 'Eventos' },
  { to: '/comercios', label: 'Comercios' },
  { to: '/noticias', label: 'Noticias' },
  { to: '/actividades', label: 'Actividades' },
]

// Barra de navegación inferior (móvil y tablet, como la cabecera compacta),
// estética "impresa" de La Gaceta: papel con filete superior de tinta; pestaña
// activa en tinta con subrayado terracota, el resto en mono apagado.
export default function NavBar() {
  return (
    <nav className="fixed bottom-0 z-40 flex w-full items-center justify-between border-t-2 border-tinta bg-papel px-6 pb-6 pt-3 font-mono-ibm text-[9.5px] uppercase tracking-etiqueta lg:hidden">
      {tabs.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            isActive
              ? 'border-b-2 border-terracota pb-0.5 text-tinta'
              : 'pb-0.5 text-mudo transition-colors hover:text-tinta'
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
