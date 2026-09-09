import { useId, useState } from 'react'

const PREFIJO = 'panel-como-funciona:'

// El estado se guarda por sección: abrir la explicación de Comercios no debe
// desplegar la de Eventos, que es texto distinto y se lee una sola vez.
function leerAbierto(seccion) {
  try {
    return localStorage.getItem(PREFIJO + seccion) === '1'
  } catch {
    // Modo privado o almacenamiento bloqueado: se cae al valor por defecto.
    return false
  }
}

/**
 * Disclosure «¿Cómo funciona? ▾» que envuelve el párrafo introductorio de una
 * sección del panel. Cerrado por defecto: la explicación es de primera visita y
 * competía por la atención con la tabla, que es a lo que se viene.
 */
export default function ComoFunciona({ seccion, children }) {
  const [abierto, setAbierto] = useState(() => leerAbierto(seccion))
  const idPanel = useId()

  const alternar = () => {
    const siguiente = !abierto
    setAbierto(siguiente)
    try {
      localStorage.setItem(PREFIJO + seccion, siguiente ? '1' : '0')
    } catch {
      // Que no se pueda recordar la preferencia no debe romper el desplegable.
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        aria-controls={idPanel}
        className="inline-flex items-center gap-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo transition-colors hover:text-tinta"
      >
        ¿Cómo funciona?
        <span aria-hidden="true">{abierto ? '▴' : '▾'}</span>
      </button>
      <div id={idPanel} hidden={!abierto} className="mt-2">
        {children}
      </div>
    </div>
  )
}
