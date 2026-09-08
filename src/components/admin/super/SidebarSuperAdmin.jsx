import { Link } from 'react-router-dom'
import MIcon from '../../MIcon.jsx'
import ListaSeccionesSuperAdmin from './ListaSeccionesSuperAdmin.jsx'

// Navegación del panel de superadmin en escritorio. Sustituye a la fila de
// tabs horizontal, que con once secciones ya solo se podía recorrer haciendo
// scroll lateral y no dejaba ver de un vistazo dónde había trabajo pendiente.
//
// Las secciones, sus grupos y sus contadores viven en src/lib/navSuperAdmin.js
// y la lista en sí en ListaSeccionesSuperAdmin.jsx: aquí solo queda el
// envoltorio de escritorio (ancho fijo, cabecera y pie con la cuenta).
//
// La paleta `nocturno` es exclusiva de /admin: el backoffice es oscuro para
// que no se confunda con la app pública, que es "La Gaceta" sobre papel.

const ANCHO = 248

export default function SidebarSuperAdmin({
  seccionActiva,
  onCambiarSeccion,
  resumen,
  usuario,
  onAbrirInfoUsuario,
  onCerrarSesion,
}) {
  const inicial = (usuario?.nombre || usuario?.email || '?').trim().charAt(0).toUpperCase()

  return (
    <nav
      aria-label="Panel de superadmin"
      data-testid="nav-superadmin"
      className="flex shrink-0 flex-col bg-nocturno-sidebar"
      style={{ width: ANCHO }}
    >
      {/* Cabecera: el logotipo apilado de la app + la marca del backoffice */}
      <div className="border-b border-nocturno-borde px-5 py-5">
        <div className="font-logo text-[19px] uppercase leading-[0.95] tracking-tight text-nocturno-texto">
          <span className="block">En</span>
          <span className="block text-naranja">Navalcarnero</span>
        </div>
        <p className="mt-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-secundario">
          Superadmin
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <ListaSeccionesSuperAdmin
          seccionActiva={seccionActiva}
          onCambiarSeccion={onCambiarSeccion}
          resumen={resumen}
        />
      </div>

      <div className="border-t border-nocturno-borde px-3 py-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-[9px] px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-secundario transition-colors hover:bg-nocturno-seccion hover:text-nocturno-texto"
        >
          <MIcon name="arrow_back" className="text-[15px]" />
          Volver a la app
        </Link>

        <div className="mt-2 flex items-center gap-2 border-t border-nocturno-borde pt-3">
          <button
            type="button"
            onClick={onAbrirInfoUsuario}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left transition-colors hover:bg-nocturno-seccion"
            title="Información de usuario"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nocturno-outline font-serif-dm text-[14px] text-nocturno-texto"
              aria-hidden="true"
            >
              {inicial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-serif-spectral text-[13px] text-nocturno-texto">
                {usuario?.nombre || 'Superadmin'}
              </span>
              <span className="block font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-nocturno-secundario">
                Ver mi cuenta
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onCerrarSesion}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="shrink-0 rounded-[9px] p-2 text-nocturno-secundario transition-colors hover:bg-nocturno-seccion hover:text-terracota-legible"
          >
            <MIcon name="logout" className="text-[18px]" />
          </button>
        </div>
      </div>
    </nav>
  )
}
