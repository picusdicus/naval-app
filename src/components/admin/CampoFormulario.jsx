import MIcon from '../MIcon.jsx'

const CLASES_CONTROL =
  'w-full rounded-lg border bg-surface-container-lowest px-4 py-3 text-base text-on-surface transition-all placeholder:text-on-surface/40 focus:outline-none focus:ring-2 disabled:opacity-60'

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
        className: `${CLASES_CONTROL} ${borde(Boolean(error))}`,
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
