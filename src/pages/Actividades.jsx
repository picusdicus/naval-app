import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MIcon from '../components/MIcon.jsx'
import { cartelDe } from '../lib/gaceta.js'
import { diasHasta } from '../lib/fechas.js'
import { ETIQUETAS_ACTIVIDAD, useNoticiasPublicas } from '../lib/useNoticiasPublicas.js'

// Iconos por categoría de actividad (chips y fallback del cartel).
const ICONOS_ACTIVIDAD = {
  deporte: 'sports_soccer',
  talleres: 'palette',
  infantil: 'child_care',
  mayores: 'elderly',
  educacion: 'school',
  ayudas: 'volunteer_activism',
  empleo: 'work',
  general: 'app_registration',
}

// Con pocos días de plazo el aviso pasa a terracota para que no se escape.
const UMBRAL_ULTIMOS_DIAS = 5

function formatearPlazo(iso) {
  const fecha = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(fecha)
}

// Texto del badge de plazo: null si la actividad no indica fecha límite.
function textoPlazo(fechaLimite) {
  if (!fechaLimite) return null
  const dias = diasHasta(fechaLimite)
  if (dias === 0) return 'Último día de plazo'
  if (dias <= UMBRAL_ULTIMOS_DIAS) return `Quedan ${dias} días · hasta el ${formatearPlazo(fechaLimite)}`
  return `Plazo hasta el ${formatearPlazo(fechaLimite)}`
}

export default function Actividades() {
  const { actividades, cargando } = useNoticiasPublicas()
  const [categoria, setCategoria] = useState(null)

  // Solo se ofrecen como filtro las categorías con alguna actividad en plazo.
  const categoriasDisponibles = useMemo(() => {
    const presentes = new Set(actividades.map((a) => a.categoria))
    return Object.keys(ETIQUETAS_ACTIVIDAD).filter((c) => presentes.has(c))
  }, [actividades])

  const listado = useMemo(
    () => (categoria ? actividades.filter((a) => a.categoria === categoria) : actividades),
    [actividades, categoria]
  )

  return (
    <div className="mx-auto max-w-3xl">
      {/* Masthead */}
      <header className="gz-filete-doble pb-3">
        <div className="gz-label text-mudo">Apúntate en el municipio</div>
        <h1 className="font-serif-dm text-seccion leading-none text-tinta">Actividades</h1>
      </header>

      <p className="mt-4 font-serif-spectral text-sm text-pardo">
        Inscripciones y plazos abiertos: talleres, escuelas deportivas, campamentos, ayudas…
        Cuando el plazo termina, la actividad desaparece de esta lista.
      </p>

      {/* Filtro por categoría */}
      {categoriasDisponibles.length > 1 && (
        <div className="hide-scrollbar mt-5 flex flex-wrap gap-2 py-1 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta">
          <button
            type="button"
            onClick={() => setCategoria(null)}
            className={`flex-none whitespace-nowrap px-3 py-2 transition-colors ${
              categoria === null ? 'bg-tinta text-papel' : 'border border-tinta text-tinta hover:bg-papel-calido'
            }`}
          >
            Todas
          </button>
          {categoriasDisponibles.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              className={`flex-none whitespace-nowrap px-3 py-2 transition-colors ${
                categoria === c ? 'bg-tinta text-papel' : 'border border-tinta text-tinta hover:bg-papel-calido'
              }`}
            >
              {ETIQUETAS_ACTIVIDAD[c]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 h-px bg-tinta" />

      {listado.length === 0 && (
        <p className="mt-6 border border-dashed border-filete-punteado p-8 text-center font-serif-spectral text-pardo">
          {cargando
            ? 'Cargando actividades…'
            : 'Ahora mismo no hay inscripciones abiertas. Cuando el Ayuntamiento publique un nuevo plazo, aparecerá aquí.'}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        {listado.map((a) => {
          const plazo = textoPlazo(a.fechaLimite)
          const urgePlazo = a.fechaLimite && diasHasta(a.fechaLimite) <= UMBRAL_ULTIMOS_DIAS
          const cartel = cartelDe('bosque')
          const icono = ICONOS_ACTIVIDAD[a.categoria] || ICONOS_ACTIVIDAD.general
          return (
            <Link
              key={a.id}
              to={`/noticias/${a.id}`}
              className="group gz-tarjeta-impresa overflow-hidden transition-colors hover:bg-papel-calido"
            >
              <article>
                <div
                  className={`relative aspect-[16/10] overflow-hidden ${a.imagen ? '' : cartel.trama}`}
                  style={a.imagen ? undefined : { background: cartel.fondo }}
                >
                  {a.imagen ? (
                    <img
                      src={a.imagen}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-25">
                      <MIcon name={icono} className="text-[56px] text-white" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
                    {ETIQUETAS_ACTIVIDAD[a.categoria] || 'General'}
                  </div>
                  <p className="mt-1 font-serif-dm text-lg leading-tight text-tinta">{a.titulo}</p>
                  <p className="mt-2 line-clamp-2 font-serif-spectral text-sm text-pardo">
                    {a.resumen || a.contenido}
                  </p>
                  {plazo && (
                    <div
                      className={`mt-3 flex items-center gap-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta ${
                        urgePlazo ? 'text-terracota' : 'text-tinta'
                      }`}
                    >
                      <MIcon name="schedule" className="text-[14px]" />
                      {plazo}
                    </div>
                  )}
                </div>
              </article>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
