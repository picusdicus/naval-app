import MIcon from '../../MIcon.jsx'
import { SECCIONES_FRECUENTES, contadorDe, esTarea } from '../../../lib/navSuperAdmin.js'

// Barra inferior de cinco destinos (móvil). Reemplaza a la fila de tabs
// horizontal, que con doce secciones obligaba a un scroll lateral a ciegas:
// aquí lo que se visita a diario está siempre a la vista y el resto vive en el
// drawer, que es la lista completa.
export default function BarraInferiorSuperAdmin({
  seccionActiva,
  onCambiarSeccion,
  onAbrirMenu,
  resumen,
}) {
  return (
    <nav
      aria-label="Secciones frecuentes"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-nocturno-borde bg-nocturno-sidebar pb-[env(safe-area-inset-bottom)]"
    >
      {SECCIONES_FRECUENTES.map(([clave, icono, etiqueta]) => {
        const esMenu = clave === null
        const activo = !esMenu && seccionActiva === clave
        const contador = esMenu ? null : contadorDe(clave, resumen)
        // Un punto y no el número: en 72 px de ancho una pastilla con cifra
        // compite con la etiqueta. La cifra exacta está en la campana, en el
        // drawer y en el Resumen; aquí solo hace falta saber que hay cola.
        const pendiente = esTarea(contador)

        return (
          <button
            key={etiqueta}
            type="button"
            onClick={() => (esMenu ? onAbrirMenu() : onCambiarSeccion(clave))}
            aria-current={activo ? 'page' : undefined}
            // Nombre accesible distinto del que lleva el mismo destino en el
            // drawer: si coincidieran, un `getByRole` por etiqueta encontraría
            // dos botones en cuanto el drawer estuviera abierto.
            aria-label={
              esMenu
                ? 'Más secciones'
                : `Ir a ${etiqueta}${pendiente ? `, ${contador.valor} pendientes` : ''}`
            }
            className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors active:bg-nocturno-seccion"
          >
            <span
              className={`relative flex h-6 w-12 items-center justify-center rounded-full transition-colors ${
                activo ? 'bg-terracota text-papel' : 'text-nocturno-texto'
              }`}
            >
              <MIcon name={icono} className="text-[20px]" />
              {pendiente && (
                <span
                  aria-hidden="true"
                  className={`absolute right-2.5 top-0 h-2 w-2 rounded-full ${
                    activo ? 'bg-papel' : 'bg-terracota'
                  }`}
                />
              )}
            </span>
            <span
              // 8,5 px y sin `tracking-etiqueta`: la etiqueta más larga
              // ("RECLAMACIONES") tiene que caber en una columna de ~70 px sin
              // desbordar sobre las vecinas, y una sola palabra no parte.
              className={`w-full text-center font-mono-ibm text-[8.5px] uppercase leading-[1.15] ${
                activo ? 'text-nocturno-texto' : 'text-nocturno-secundario'
              }`}
            >
              {etiqueta}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
