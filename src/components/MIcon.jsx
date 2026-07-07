// Icono de Material Symbols (fuente cargada en index.html), como en las
// referencias de diseño. El tamaño se controla con clases text-[Npx].
export default function MIcon({ name, className = '', fill = false }) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}
