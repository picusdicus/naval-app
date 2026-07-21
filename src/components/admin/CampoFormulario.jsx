import MIcon from '../MIcon.jsx'

const CLASES_CONTROL =
  'w-full border px-3.5 py-3 font-serif-spectral text-sm transition-colors placeholder:text-mudo focus:outline-none disabled:opacity-60'

// Los campos de solo lectura no compiten por el mismo `bg-*` que los
// editables: Tailwind resuelve el conflicto por orden en la hoja de estilos,
// no por el orden en el atributo class, así que se elige uno u otro aquí.
// Bloqueado = fondo cálido (perfil de la org), como .gz-input-bloqueado.
const fondo = (soloLectura) =>
  soloLectura ? 'bg-papel-calido text-tinta cursor-not-allowed' : 'bg-papel text-tinta'

const borde = (hayError) =>
  hayError ? 'border-terracota' : 'border-filete focus:border-tinta'

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
      <label
        htmlFor={id}
        className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo"
      >
        {etiqueta}
        {opcional && <span className="ml-1.5 normal-case tracking-normal text-mudo">(opcional)</span>}
      </label>

      {children({
        className: `${CLASES_CONTROL} ${fondo(soloLectura)} ${borde(Boolean(error))}`,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': error ? idError : undefined,
      })}

      {ayuda && !error && <p className="mt-1.5 font-mono-ibm text-[10px] text-mudo">{ayuda}</p>}

      {error && (
        <p
          id={idError}
          className="mt-1.5 flex items-center gap-1 font-serif-spectral text-xs font-medium text-terracota"
        >
          <MIcon name="error" className="text-[14px]" />
          {error}
        </p>
      )}
    </div>
  )
}
