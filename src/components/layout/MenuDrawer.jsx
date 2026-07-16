import { NavLink } from 'react-router-dom'
import MIcon from '../MIcon.jsx'

const rutas = [
  { to: '/', label: 'Inicio', icono: 'home', end: true },
  { to: '/eventos', label: 'Eventos', icono: 'calendar_today' },
  { to: '/comercios', label: 'Comercios', icono: 'storefront' },
  { to: '/noticias', label: 'Noticias', icono: 'newspaper' },
  { to: '/asistente', label: 'Asistente IA', icono: 'smart_toy' },
]

// Menú lateral deslizable (referencia: reference/menu). Se muestra sobre un
// scrim y se cierra al pulsar fuera o al navegar.
export default function MenuDrawer({ abierto, onCerrar, onLogout }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex transition-opacity duration-300 ${
        abierto ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!abierto}
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-on-surface/40" onClick={onCerrar} />

      {/* Panel */}
      <aside
        className={`relative flex h-full w-80 transform flex-col rounded-r-xl bg-surface p-4 shadow-card-lg transition-transform duration-300 ease-out ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabecera */}
        <div className="mb-8 flex flex-col border-b border-surface-container-high px-2 pb-6 pt-4">
          <div className="mb-4 flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full bg-primary-container p-2 shadow-md">
              <img src="/logo.png" alt="" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col">
              <h2 className="font-display text-xl font-semibold leading-tight text-primary">
                Navalcarnero
              </h2>
              <span className="text-sm font-semibold text-on-surface-variant">
                Tu plaza digital
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant opacity-70">
            <MIcon name="location_on" className="text-[18px]" />
            <span className="text-xs font-medium">Comunidad de Madrid</span>
          </div>
        </div>

        {/* Enlaces */}
        <nav className="hide-scrollbar flex-1 space-y-2 overflow-y-auto">
          {rutas.map((r) => (
            <NavLink
              key={r.to}
              to={r.to}
              end={r.end}
              onClick={onCerrar}
              className={({ isActive }) =>
                isActive
                  ? 'flex items-center gap-4 rounded-lg bg-primary-container p-3 font-bold text-on-primary-container'
                  : 'group flex items-center gap-4 rounded-lg p-3 text-on-surface-variant transition-all hover:bg-surface-container-high'
              }
            >
              <MIcon name={r.icono} />
              <span className="text-base">{r.label}</span>
            </NavLink>
          ))}

          <div className="mx-2 my-4 h-px bg-surface-container-high" />

          <a
            href="tel:112"
            className="group flex items-center gap-4 rounded-lg p-3 text-on-surface-variant transition-all hover:bg-surface-container-high"
          >
            <MIcon name="emergency" className="text-error" />
            <span className="text-base group-hover:text-primary">Emergencias (112)</span>
          </a>
          <a
            href="tel:918101141"
            className="group flex items-center gap-4 rounded-lg p-3 text-on-surface-variant transition-all hover:bg-surface-container-high"
          >
            <MIcon name="account_balance" />
            <span className="text-base group-hover:text-primary">Ayuntamiento</span>
          </a>
        </nav>

        {/* Pie */}
        <div className="mt-auto flex flex-col gap-4 border-t border-surface-container-high pt-6">
          <div className="flex items-center justify-between px-2">
            <span className="font-bold text-primary">Navalcarnero</span>
            <span className="text-[10px] uppercase tracking-widest text-on-surface-variant">
              v0.1.0
            </span>
          </div>
          <a
            href="tel:918101141"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface-container-high p-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-secondary-container hover:text-on-secondary-container"
          >
            <MIcon name="call" className="text-[18px]" />
            Llamar al Ayuntamiento
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-error/10 p-3 text-sm font-semibold text-error transition-colors hover:bg-error/20 active:scale-95"
          >
            <MIcon name="logout" className="text-[18px]" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </div>
  )
}
