import { useEffect, useRef } from 'react'
import MIcon from './MIcon'
import { esIOS, esPWAInstalada } from '../lib/push.js'
import { esSafariEnIOS } from '../lib/instalacion.js'

// Icono de Compartir de iOS (cuadrado con flecha hacia arriba), dibujado a
// mano en trazo como los de IconosRedes: la CSP no permite cargar imágenes de
// fuera y así casa con los Material Symbols.
function IconoCompartirIOS({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8.5 8H7a1.5 1.5 0 0 0-1.5 1.5V19A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V9.5A1.5 1.5 0 0 0 17 8h-1.5" />
      <path d="M12 13.5v-10" />
      <path d="M9 6.5l3-3 3 3" />
    </svg>
  )
}

// Icono de "Añadir a pantalla de inicio" (cuadrado con +), mismo estilo.
function IconoAnadirInicio({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  )
}

function Paso({ numero, children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-tinta font-mono-ibm text-xs text-papel">
        {numero}
      </span>
      <span className="font-serif-spectral text-[15px] leading-relaxed text-tinta">{children}</span>
    </li>
  )
}

/**
 * Instrucciones de instalación manual. Se abre desde el botón "Instalar app"
 * del menú lateral cuando no hay prompt nativo que lanzar: siempre en
 * iPhone/iPad (Safari no emite `beforeinstallprompt` — no es un fallo, esa
 * API no existe en iOS) y como fallback en navegadores sin el evento.
 */
export default function DialogoInstalarApp({ abierto, onCerrar }) {
  const dialogo = useRef(null)

  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  // Las variantes se deciden al renderizar (el UA no cambia en vivo).
  const ios = esIOS()
  const safariIOS = esSafariEnIOS()
  const instalada = esPWAInstalada()

  return (
    <dialog
      ref={dialogo}
      onCancel={(e) => {
        e.preventDefault()
        onCerrar()
      }}
      onClick={(e) => {
        if (e.target === dialogo.current) onCerrar()
      }}
      className="w-full max-w-md border border-tinta bg-papel p-0 shadow-cartel backdrop:bg-tinta/40"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tinta">
            <MIcon name="install_mobile" className="text-[24px] text-oro" />
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1 text-pardo transition-colors hover:text-terracota"
            aria-label="Cerrar"
          >
            <MIcon name="close" className="text-[20px]" />
          </button>
        </div>

        <h2 className="mt-4 font-serif-dm text-2xl text-tinta">Instalar la app</h2>

        {instalada ? (
          <p className="mt-2 font-serif-spectral text-sm text-pardo">
            Ya estás usando la app instalada — no hace falta nada más.
          </p>
        ) : ios ? (
          <>
            <p className="mt-1 font-serif-spectral text-sm text-pardo">
              En iPhone y iPad se instala desde el menú compartir, sin pasar por la App Store:
            </p>
            <ol className="mt-4 space-y-3 border border-filete bg-papel-calido p-4">
              <Paso numero="1">
                Toca el icono de <span className="font-semibold">Compartir</span>{' '}
                <IconoCompartirIOS className="inline-block h-[22px] w-[22px] align-text-bottom text-terracota" />{' '}
                {safariIOS
                  ? '(el cuadrado con la flecha hacia arriba, en la barra de abajo de Safari).'
                  : '(el cuadrado con la flecha hacia arriba; en este navegador suele estar junto a la barra de direcciones).'}
              </Paso>
              <Paso numero="2">
                Baja en la lista y elige{' '}
                <span className="font-semibold">«Añadir a pantalla de inicio»</span>{' '}
                <IconoAnadirInicio className="inline-block h-[20px] w-[20px] align-text-bottom text-terracota" />
                .
              </Paso>
              <Paso numero="3">Confirma con «Añadir»: la app aparecerá con su icono, como cualquier otra.</Paso>
            </ol>
            {!safariIOS && (
              <p className="mt-3 font-serif-spectral text-sm text-pardo">
                Si no encuentras la opción, abre esta página en{' '}
                <span className="font-semibold">Safari</span> y sigue los mismos pasos.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mt-1 font-serif-spectral text-sm text-pardo">
              Tu navegador no ha ofrecido la instalación automática, pero puedes hacerlo a mano:
            </p>
            <ol className="mt-4 space-y-3 border border-filete bg-papel-calido p-4">
              <Paso numero="1">
                Abre el menú del navegador (el botón <span className="font-semibold">⋮</span> o{' '}
                <span className="font-semibold">≡</span>, junto a la barra de direcciones).
              </Paso>
              <Paso numero="2">
                Elige <span className="font-semibold">«Instalar app»</span> o{' '}
                <span className="font-semibold">«Añadir a pantalla de inicio»</span>.
              </Paso>
            </ol>
          </>
        )}

        <button type="button" onClick={onCerrar} className="gz-boton-tinta mt-5 w-full">
          Entendido
        </button>
      </div>
    </dialog>
  )
}
