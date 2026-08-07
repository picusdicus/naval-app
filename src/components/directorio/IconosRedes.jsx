// Iconos de redes sociales para la ficha de comercio. Van dibujados a mano
// (trazo de 1.8 sobre viewBox 24) en vez de usar los logos de marca: así casan
// con los Material Symbols outline del resto de la app y no hace falta cargar
// una librería de iconos ni servir SVGs externos (la CSP no lo permitiría).

const trazo = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Marco({ children }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true" {...trazo}>
      {children}
    </svg>
  )
}

const Instagram = () => (
  <Marco>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
  </Marco>
)

const Facebook = () => (
  <Marco>
    <path d="M14.5 21v-8h2.6l.5-3h-3.1V8.2c0-.9.3-1.4 1.5-1.4H17.7V4.1A19 19 0 0 0 15.4 4c-2.4 0-4 1.4-4 4v2H8.8v3h2.6v8" />
  </Marco>
)

const Twitter = () => (
  <Marco>
    <path d="M4 4l7 9.2M20 20l-7.4-9.6M4 4h3.2L20 20h-3.2M20 4l-6.6 7.2M10.6 12.8 4 20" />
  </Marco>
)

const TikTok = () => (
  <Marco>
    <path d="M14.5 3v11.2a3.9 3.9 0 1 1-3.9-3.9c.4 0 .7 0 1 .1" />
    <path d="M14.5 3c.4 2.6 2.2 4.3 4.8 4.6" />
  </Marco>
)

const LinkedIn = () => (
  <Marco>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M7.4 10.5V17M11.2 17v-3.6a2.2 2.2 0 0 1 4.4 0V17" />
    <circle cx="7.4" cy="7.4" r="1" fill="currentColor" stroke="none" />
  </Marco>
)

const Web = () => (
  <Marco>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.4 9.5h17.2M3.4 14.5h17.2M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3z" />
  </Marco>
)

// Orden de aparición en la ficha. `campo` es la columna de comercios_perfil.
export const REDES = [
  { campo: 'instagram', nombre: 'Instagram', Icono: Instagram },
  { campo: 'facebook', nombre: 'Facebook', Icono: Facebook },
  { campo: 'twitter', nombre: 'X', Icono: Twitter },
  { campo: 'tiktok', nombre: 'TikTok', Icono: TikTok },
  { campo: 'linkedin', nombre: 'LinkedIn', Icono: LinkedIn },
  { campo: 'web', nombre: 'Web', Icono: Web },
]

/**
 * Fila de iconos enlazados. `enlaces` es un objeto {instagram, facebook, …};
 * solo se pintan los que tengan valor. Devuelve null si no hay ninguno, para
 * que el bloque de contacto no muestre una fila vacía.
 */
export default function IconosRedes({ enlaces, className = '' }) {
  const presentes = REDES.filter((red) => enlaces?.[red.campo])
  if (presentes.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {presentes.map(({ campo, nombre, Icono }) => (
        <a
          key={campo}
          href={enlaces[campo]}
          target="_blank"
          rel="noopener noreferrer"
          title={nombre}
          aria-label={nombre}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-filete text-tinta transition-colors hover:border-tinta hover:bg-tinta hover:text-papel"
        >
          <Icono />
        </a>
      ))}
    </div>
  )
}
