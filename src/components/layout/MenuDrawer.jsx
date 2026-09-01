import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import MIcon from '../MIcon.jsx'
import Logo from '../Logo.jsx'
import DialogoInstalarApp from '../DialogoInstalarApp.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import { esIOS, esPWAInstalada } from '../../lib/push.js'
import { hayPromptDeInstalacion, pedirInstalacionNativa } from '../../lib/instalacion.js'

const rutas = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/eventos', label: 'Eventos' },
  { to: '/comercios', label: 'Comercios' },
  { to: '/noticias', label: 'Noticias' },
  { to: '/ayuda', label: 'Preguntas frecuentes' },
  { to: '/sugerencias', label: 'Buzón de sugerencias' },
]

// Menú lateral deslizable, estética La Gaceta: panel papel con borde de tinta,
// logotipo apilado + filete doble, ítem activo en terracota. Estado (abierto) y
// cierre los controla Layout; la animación es CSS pura sobre `abierto`.
export default function MenuDrawer({ abierto, onCerrar, onLogout }) {
  const { usuario, cargando } = useAdminAuth()
  const [instalarAbierto, setInstalarAbierto] = useState(false)

  // "Instalar app": con prompt nativo capturado (Chrome/Edge/Android) se lanza
  // directamente; sin él (iOS siempre — beforeinstallprompt no existe ahí —,
  // o navegadores que no lo emiten) se abren las instrucciones manuales.
  const manejarInstalar = async () => {
    if (!esIOS() && hayPromptDeInstalacion()) {
      await pedirInstalacionNativa()
      return
    }
    setInstalarAbierto(true)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex transition-opacity duration-300 ${
        abierto ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!abierto}
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-tinta/50" onClick={onCerrar} />

      {/* Panel */}
      <aside
        className={`relative flex h-full w-80 transform flex-col border-r-2 border-tinta bg-papel transition-transform duration-300 ease-out ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabecera */}
        <div className="px-6 pb-4 pt-6">
          <Logo tamano="lg" />
          <div className="mt-2 font-serif-spectral text-sm italic text-pardo">Tu plaza digital</div>
          <div className="mt-3 flex items-center gap-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
            <MIcon name="location_on" className="text-[14px]" />
            <span>Comunidad de Madrid</span>
          </div>
        </div>
        <div className="gz-filete-doble mx-6" />

        {/* Enlaces */}
        <nav className="hide-scrollbar flex-1 space-y-0.5 overflow-y-auto p-4 font-serif-dm text-[19px]">
          {rutas.map((r) => (
            <NavLink
              key={r.to}
              to={r.to}
              end={r.end}
              onClick={onCerrar}
              className={({ isActive }) =>
                isActive
                  ? 'block bg-terracota px-3.5 py-2.5 text-papel'
                  : 'block px-3.5 py-2.5 text-tinta transition-colors hover:bg-papel-calido'
              }
            >
              {r.label}
            </NavLink>
          ))}

          <a
            href="tel:112"
            className="block px-3.5 py-2.5 text-terracota transition-colors hover:bg-papel-calido"
          >
            Emergencias (112)
          </a>
          <a
            href="tel:918101141"
            className="block px-3.5 py-2.5 text-tinta transition-colors hover:bg-papel-calido"
          >
            Ayuntamiento
          </a>

          {/* Corriendo ya en standalone el botón sobra. */}
          {!esPWAInstalada() && (
            <button
              type="button"
              onClick={manejarInstalar}
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-tinta transition-colors hover:bg-papel-calido"
            >
              <MIcon name="install_mobile" className="text-[20px] text-terracota" />
              Instalar app
            </button>
          )}

          {!cargando && (
            <>
              <div className="border-t border-filete my-2" />
              {/* Con sesión abierta el enlace lleva al panel que le toca al rol:
                  en el móvil este menú es la única vía de vuelta a la gestión. */}
              <NavLink
                to={usuario ? (usuario.rol === 'superadmin' ? '/admin' : '/panel') : '/login'}
                end={false}
                onClick={onCerrar}
                className={({ isActive }) =>
                  isActive
                    ? 'block bg-terracota px-3.5 py-2.5 text-papel'
                    : 'block px-3.5 py-2.5 text-tinta transition-colors hover:bg-papel-calido'
                }
              >
                {usuario ? 'Mi panel' : 'Login'}
              </NavLink>
            </>
          )}
        </nav>

        {/* Pie */}
        <div className="mt-auto flex flex-col gap-3 border-t border-filete p-6">
          <div className="flex items-center justify-between font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
            <span className="text-tinta">Navalcarnero</span>
            <span>v0.1.0</span>
          </div>
          <a
            href="tel:918101141"
            className="gz-boton-borde flex items-center justify-center gap-2 transition-colors hover:bg-papel-calido"
          >
            Llamar al Ayuntamiento
          </a>
          <button type="button" onClick={onLogout} className="gz-boton-peligro">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <DialogoInstalarApp abierto={instalarAbierto} onCerrar={() => setInstalarAbierto(false)} />
    </div>
  )
}
