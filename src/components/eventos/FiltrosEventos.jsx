import { useMemo } from 'react'
import { CATEGORIAS_EVENTO, LISTA_CATEGORIAS_EVENTO } from '../../lib/eventos'
import MIcon from '../MIcon'

// Chip de filtro: el botón aporta el área de toque (≥44 px de alto) y la píldora
// interior es la parte visible, más pequeña — así el tap es cómodo en móvil sin
// engordar el chip.
function ChipTipo({ activo, onClick, color, etiqueta, contador, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={ariaLabel}
      className="flex min-h-[44px] flex-shrink-0 items-center"
    >
      <span
        className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 font-mono-ibm text-xs font-semibold tracking-wider transition-all ${
          activo ? 'bg-tinta text-papel' : 'border border-[#d9d0ba] bg-papel text-tinta'
        }`}
      >
        {color && (
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
        )}
        {etiqueta}
        <span className={activo ? 'text-papel/70' : 'text-pardo'}>{contador}</span>
      </span>
    </button>
  )
}

/**
 * Fila de filtros por tipo: una sola fila con scroll horizontal (como la tira
 * de días), nunca envuelve a varias líneas. Contadores sobre el conjunto pasado.
 */
export default function FiltrosEventos({
  eventos = [],
  categoriasActivas = [],
  onCategoriaToggle = () => {},
  onLimpiar = () => {},
}) {
  const contadores = useMemo(() => {
    const counts = {}
    LISTA_CATEGORIAS_EVENTO.forEach((cat) => {
      counts[cat.id] = eventos.filter((e) => e.categoria === cat.id).length
    })
    return counts
  }, [eventos])

  const categoriasDisponibles = LISTA_CATEGORIAS_EVENTO.filter((cat) => contadores[cat.id] > 0)

  return (
    <div className="mb-6 w-full">
      {/* Cabecera: etiqueta TIPO + Limpiar */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono-ibm text-[11px] uppercase font-semibold tracking-etiqueta text-pardo">
          Tipo
        </span>
        {categoriasActivas.length > 0 && (
          <button
            type="button"
            onClick={onLimpiar}
            className="inline-flex flex-shrink-0 items-center gap-1 font-mono-ibm text-[11px] uppercase font-semibold tracking-etiqueta text-terracota transition hover:text-tinta"
          >
            <MIcon name="close" className="text-sm" />
            Limpiar
          </button>
        )}
      </div>

      {/* Carril de chips en una sola fila con scroll horizontal + fade derecho */}
      <div className="relative">
        <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1 pr-8">
          <ChipTipo
            activo={categoriasActivas.length === 0}
            onClick={onLimpiar}
            etiqueta="Todos"
            contador={eventos.length}
            ariaLabel="Todos los tipos"
          />
          {categoriasDisponibles.map((cat) => (
            <ChipTipo
              key={cat.id}
              activo={categoriasActivas.includes(cat.id)}
              onClick={() => onCategoriaToggle(cat.id)}
              color={cat.color}
              etiqueta={cat.nombre}
              contador={contadores[cat.id]}
              ariaLabel={cat.nombre}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-papel to-transparent" />
      </div>

      {/* Filete separador, con aire por encima y por debajo */}
      <div className="mt-4 border-b border-[#d9d0ba]" />
    </div>
  )
}
