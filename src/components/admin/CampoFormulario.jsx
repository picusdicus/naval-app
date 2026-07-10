import MIcon from '../MIcon.jsx'

const CLASES_CONTROL =
  'w-full rounded-lg border px-4 py-3 text-base transition-all placeholder:text-on-surface/40 focus:outline-none focus:ring-2 disabled:opacity-60'

// Los campos de solo lectura no compiten por el mismo `bg-*` que los
// editables: Tailwind resuelve el conflicto por orden en la hoja de estilos,
// no por el orden en el atributo class, así que se elige uno u otro aquí.
const fondo = (soloLectura) =>
  soloLectura
    ? 'bg-surface-container-high text-on-surface/70 cursor-not-allowed'
    : 'bg-surface-container-lowest text-on-surface'

const borde = (hayError) =>
  hayError
    ? 'border-error focus:border-error focus:ring-error/20'
    : 'border-outline-variant/30 focus:border-primary focus:ring-primary/20'

/**
 * Etiqueta + control + mensaje de error, con el aria-invalid/aria-describedby
 * que necesitan los lectores de pantalla. `children` recibe las clases y los
 * atributos de accesibilidad ya calculados.
 */
export default function CampoFormulario({
  id,
  etiqueta,
  error,
  opcional = false,
  soloLectura = false,
  ayuda,
  children,
}) {
  const idError = `${id}-error`

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-on-surface">
        {etiqueta}
        {opcional && <span className="ml-1.5 font-normal text-on-surface/50">(opcional)</span>}
      </label>

      {children({
        className: `${CLASES_CONTROL} ${fondo(soloLectura)} ${borde(Boolean(error))}`,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': error ? idError : undefined,
      })}

      {ayuda && !error && <p className="mt-1.5 text-xs text-on-surface/60">{ayuda}</p>}

      {error && (
        <p id={idError} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-error">
          <MIcon name="error" className="text-[14px]" />
          {error}
        </p>
      )}
    </div>
  )
}
