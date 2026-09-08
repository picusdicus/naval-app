import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import MIcon from '../../MIcon.jsx'
import ListaSeccionesSuperAdmin from './ListaSeccionesSuperAdmin.jsx'

// Menú completo del panel en móvil: las mismas secciones, grupos y contadores
// que la sidebar de escritorio (comparten ListaSeccionesSuperAdmin), para lo
// que no cabe en los cinco destinos de la barra inferior.
//
// ⚠️ Lo monta el panel de forma condicional: cerrado, este componente no
// existe en el DOM. Dejarlo montado con `display:none` pondría una segunda
// navegación con las mismas etiquetas al alcance de cualquier recuento de
// botones por texto —el de los e2e y el de un lector de pantalla—, que es
// justo lo que se arregló al sustituir las tabs por la sidebar.
export default function DrawerSuperAdmin({
  seccionActiva,
  onCambiarSeccion,
  onCerrar,
  resumen,
  usuario,
  onCerrarSesion,
}) {
  // Escape cierra, y el fondo de la página no se desplaza bajo el menú.
  useEffect(() => {
    const alPulsarTecla = (e) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPulsarTecla)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPulsarTecla)
      document.body.style.overflow = overflowPrevio
    }
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* El panel ocupa casi todo el ancho, pero no todo: la franja de la
          derecha es el "fuera" que se puede pulsar para cerrar, además del
          botón explícito. */}
      <div
        className="absolute inset-0 bg-tinta/70"
        onClick={onCerrar}
        aria-hidden="true"
      />

      <nav
        aria-label="Todas las secciones"
        data-testid="nav-superadmin"
        className="relative flex h-full w-[88%] max-w-[340px] flex-col bg-nocturno-sidebar"
      >
        <div className="flex items-center justify-between border-b border-nocturno-borde px-4 py-3">
          <div>
            <div className="font-logo text-[17px] uppercase leading-[0.95] tracking-tight text-nocturno-texto">
              En <span className="text-naranja">Navalcarnero</span>
            </div>
            <p className="mt-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-secundario">
              Superadmin · {usuario?.nombre || 'Superadmin'}
            </p>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar el menú"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[9px] text-nocturno-texto transition-colors hover:bg-nocturno-seccion active:scale-95"
          >
            <MIcon name="close" className="text-[22px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <ListaSeccionesSuperAdmin
            seccionActiva={seccionActiva}
            onCambiarSeccion={(clave) => {
              onCambiarSeccion(clave)
              onCerrar()
            }}
            resumen={resumen}
            compacto={false}
          />
        </div>

        <div className="border-t border-nocturno-borde px-3 py-3">
          <Link
            to="/"
            className="flex min-h-[44px] items-center gap-2 rounded-[9px] px-2.5 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-nocturno-secundario transition-colors hover:bg-nocturno-seccion hover:text-nocturno-texto"
          >
            <MIcon name="arrow_back" className="text-[16px]" />
            A la app
          </Link>

          <button
            type="button"
            onClick={onCerrarSesion}
            className="mt-1 flex min-h-[44px] w-full items-center gap-2 rounded-[9px] px-2.5 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-terracota-legible transition-colors hover:bg-nocturno-seccion"
          >
            <MIcon name="logout" className="text-[16px]" />
            Cerrar sesión
          </button>
        </div>
      </nav>
    </div>
  )
}
