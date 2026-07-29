import { useMemo } from 'react'
import { CATEGORIAS_EVENTO, LISTA_CATEGORIAS_EVENTO } from '../../lib/eventos'
import MIcon from '../MIcon'

/**
 * Category filter row: chips with colored dots + counters.
 * Multiselect: clicking toggles a category on/off.
 * Counters show events in each category for the selected day + active filters.
 */
export default function FiltrosEventos({
  eventos = [],
  categoriasActivas = [],
  onCategoriaToggle = () => {},
  onLimpiar = () => {},
}) {
  // Count events per category
  const contadores = useMemo(() => {
    const counts = {}
    LISTA_CATEGORIAS_EVENTO.forEach((cat) => {
      counts[cat.id] = eventos.filter((e) => e.categoria === cat.id).length
    })
    return counts
  }, [eventos])

  // Show only categories that have events
  const categoriasDisponibles = LISTA_CATEGORIAS_EVENTO.filter(
    (cat) => contadores[cat.id] > 0
  )

  return (
    <div className="mb-6 w-full">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="font-mono-ibm text-xs uppercase font-semibold tracking-wider text-pardo whitespace-nowrap">
          Tipo
        </span>

        <div className="flex flex-wrap gap-2 flex-1">
          {/* Chip "Todos": limpia el filtro; activo cuando no hay ninguno. */}
          <button
            type="button"
            onClick={onLimpiar}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono-ibm text-xs font-semibold tracking-wider transition-all ${
              categoriasActivas.length === 0
                ? 'bg-tinta text-papel'
                : 'border border-[#d9d0ba] bg-papel text-tinta hover:border-tinta'
            }`}
            aria-pressed={categoriasActivas.length === 0}
          >
            Todos
            <span className={categoriasActivas.length === 0 ? 'text-papel/70' : 'text-pardo'}>
              {eventos.length}
            </span>
          </button>

          {categoriasDisponibles.map((cat) => {
            const activo = categoriasActivas.includes(cat.id)
            return (
              <button
                key={cat.id}
                onClick={() => onCategoriaToggle(cat.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono-ibm text-xs font-semibold tracking-wider transition-all ${
                  activo
                    ? 'bg-tinta text-papel'
                    : 'border border-[#d9d0ba] bg-papel text-tinta hover:border-tinta'
                }`}
                aria-pressed={activo}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.nombre}
                <span className="text-pardo">{contadores[cat.id]}</span>
              </button>
            )
          })}
        </div>

        {categoriasActivas.length > 0 && (
          <button
            onClick={onLimpiar}
            className="flex-shrink-0 inline-flex items-center gap-1 text-terracota font-mono-ibm text-xs uppercase font-semibold tracking-wider hover:text-tinta transition"
          >
            <MIcon name="close" className="text-sm" />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
        )}
      </div>

      {/* Bottom border */}
      <div className="border-b border-[#d9d0ba]" />
    </div>
  )
}
