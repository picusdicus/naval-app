import MIcon from '../../MIcon.jsx'
import { GRUPOS, contadorDe } from '../../../lib/navSuperAdmin.js'

// La lista de secciones agrupadas, sin envoltorio: la pintan igual la sidebar
// de escritorio y el drawer móvil, cada uno dentro de su propio contenedor.
// Es el mismo criterio que con GRUPOS/contadorDe — cuando apareció el segundo
// consumidor real, se compartió en vez de copiarse.
//
// ⚠️ Nunca se montan las dos a la vez: en el DOM hay una navegación o la otra
// (ver el useMediaQuery de AdminSuperPanel), o cualquier recuento de botones
// por texto —el de los e2e, el de un lector de pantalla— la vería duplicada.

export function Contador({ contador }) {
  if (!contador) return null
  const { valor, tono, texto } = contador
  const etiqueta = `${valor} ${texto}`

  if (tono === 'informativo') {
    return (
      <span className="font-mono-ibm text-[10.5px] text-nocturno-secundario" aria-label={etiqueta}>
        {valor}
      </span>
    )
  }

  const colores = tono === 'atencion' ? 'bg-oro text-tinta' : 'bg-terracota text-papel'
  return (
    <span
      className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center font-mono-ibm text-[10px] font-bold ${colores}`}
      aria-label={etiqueta}
    >
      {valor}
    </span>
  )
}

export default function ListaSeccionesSuperAdmin({
  seccionActiva,
  onCambiarSeccion,
  resumen,
  // Alto de fila: en móvil el objetivo táctil manda (≥44 px); en escritorio,
  // donde se apunta con ratón, la lista puede ser más compacta.
  compacto = true,
}) {
  return (
    <>
      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo || 'portada'} className="mb-4 last:mb-0">
          {grupo.titulo && (
            <h2 className="px-2 pb-2 font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-nocturno-secundario">
              {grupo.titulo}
            </h2>
          )}
          <ul className="space-y-0.5">
            {grupo.items.map(([clave, icono, etiqueta]) => {
              const activo = seccionActiva === clave
              const contador = contadorDe(clave, resumen)
              return (
                <li key={clave}>
                  <button
                    type="button"
                    onClick={() => onCambiarSeccion(clave)}
                    aria-current={activo ? 'page' : undefined}
                    // Nombre accesible explícito: sin él lo compone el
                    // navegador con el texto del botón MÁS el aria-label de la
                    // pastilla, así que cambiaba solo con que llegara el
                    // resumen (de "Organizaciones" a "Organizaciones 12
                    // organizaciones activas"). Un nombre que muta a mitad de
                    // carga es una trampa para cualquier locator por rol.
                    aria-label={contador ? `${etiqueta} (${contador.valor} ${contador.texto})` : etiqueta}
                    className={`flex w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left font-serif-spectral transition-colors ${
                      compacto ? 'py-2 text-[13.5px]' : 'min-h-[44px] py-2.5 text-[15px]'
                    } ${
                      activo
                        ? 'bg-terracota text-papel'
                        : 'text-nocturno-texto hover:bg-nocturno-seccion'
                    }`}
                  >
                    <MIcon name={icono} className="shrink-0 text-[18px]" />
                    <span className="flex-1 truncate">{etiqueta}</span>
                    <Contador contador={contador} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}
