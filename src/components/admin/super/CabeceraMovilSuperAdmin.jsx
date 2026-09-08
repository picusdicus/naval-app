import MIcon from '../../MIcon.jsx'
import { totalPendiente } from '../../../lib/navSuperAdmin.js'

// Cabecera del panel en móvil: se queda pegada arriba al hacer scroll, así que
// el menú, el estado de la cola y la cuenta están siempre a un toque sin tener
// que volver al principio de una tabla larga.
//
// Sustituye además a la franja decorativa `h-2 bg-tinta-intensa` que marcaba
// el borde superior: esta barra ya separa el backoffice de la app pública.
export default function CabeceraMovilSuperAdmin({
  usuario,
  resumen,
  onAbrirMenu,
  onIrAResumen,
  onAbrirInfoUsuario,
}) {
  const inicial = (usuario?.nombre || usuario?.email || '?').trim().charAt(0).toUpperCase()

  // La campana del panel no abre ninguna bandeja: el superadmin no recibe
  // avisos push, su cola de trabajo son las tarjetas de "Requiere tu atención"
  // del Resumen. El patrón visual sí es el de CentroAvisos (icono + pastilla
  // absoluta, "9+" al desbordar, conteo en el nombre accesible).
  const pendientes = totalPendiente(resumen)

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-1 border-b border-nocturno-borde bg-nocturno-sidebar px-2">
      <button
        type="button"
        onClick={onAbrirMenu}
        aria-label="Abrir el menú de secciones"
        className="flex h-11 w-11 items-center justify-center rounded-[9px] text-nocturno-texto transition-colors hover:bg-nocturno-seccion active:scale-95"
      >
        <MIcon name="menu" className="text-[22px]" />
      </button>

      {/* Versión corta del logotipo: en 360 px el apilado de la sidebar no cabe
          en una barra de 56 px de alto. */}
      <span className="flex-1 font-logo text-[17px] uppercase tracking-tight text-nocturno-texto">
        En<span className="text-naranja">n</span>
      </span>

      <button
        type="button"
        onClick={onIrAResumen}
        aria-label={
          pendientes > 0
            ? `Requiere tu atención (${pendientes} tareas pendientes)`
            : 'Requiere tu atención'
        }
        title="Requiere tu atención"
        className="relative flex h-11 w-11 items-center justify-center rounded-[9px] text-nocturno-texto transition-colors hover:bg-nocturno-seccion active:scale-95"
      >
        <MIcon name="notifications" className="text-[22px]" />
        {pendientes > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracota px-1 font-mono-ibm text-[10px] font-bold text-papel">
            {pendientes > 9 ? '9+' : pendientes}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onAbrirInfoUsuario}
        aria-label="Información de usuario"
        title="Información de usuario"
        className="flex h-11 w-11 items-center justify-center rounded-[9px] transition-colors hover:bg-nocturno-seccion active:scale-95"
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-nocturno-outline font-serif-dm text-[14px] text-nocturno-texto"
          aria-hidden="true"
        >
          {inicial}
        </span>
      </button>
    </header>
  )
}
