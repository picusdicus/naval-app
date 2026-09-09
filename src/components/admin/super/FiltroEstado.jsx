// Los tres estados son los mismos en Reclamaciones y en Altas de comercio: el
// array y los botones estaban duplicados letra por letra en los dos tabs.
const FILTROS = [
  { valor: 'pendiente', label: 'Pendientes' },
  { valor: 'aprobada', label: 'Aprobadas' },
  { valor: 'rechazada', label: 'Rechazadas' },
]

/**
 * Botonera de filtro por estado con el total de cada uno.
 * `conteos` es opcional: mientras el fetch está en curso llega `null` y el
 * botón se pinta sin número, en vez de anunciar un «(0)» que aún no se sabe.
 */
export default function FiltroEstado({ estadoFiltro, onCambiar, conteos }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTROS.map((filtro) => (
        <button
          key={filtro.valor}
          onClick={() => onCambiar(filtro.valor)}
          className={`px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta transition-colors ${
            estadoFiltro === filtro.valor
              ? 'bg-tinta text-papel'
              : 'border border-filete text-pardo hover:text-tinta'
          }`}
        >
          {filtro.label}
          {conteos && ` (${conteos[filtro.valor] ?? 0})`}
        </button>
      ))}
    </div>
  )
}
