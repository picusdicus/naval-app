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

// Plazos a ≤ 7 días se destacan en la franja "Últimos días" sobre la lista
// (la lista va por fecha de publicación, así que sin la franja una actividad
// antigua a punto de cerrar quedaría enterrada).
const UMBRAL_CADUCA_PRONTO = 7

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

// "Último día" / "Quedan N días" para la franja de plazos a punto de cerrar.
function textoCuentaAtras(fechaLimite) {
  const dias = diasHasta(fechaLimite)
  return dias === 0 ? 'Último día' : `Quedan ${dias} días`
}

export default function Actividades() {
  const { actividades, cargando } = useNoticiasPublicas()
  const [categoria, setCategoria] = useState(null)

  // Solo se ofrecen como filtro las categorías con alguna actividad en plazo.
  const categoriasDisponibles = useMemo(() => {
    const presentes = new Set(actividades.map((a) => a.categoria))
    return Object.keys(ETIQUETAS_ACTIVIDAD).filter((c) => presentes.has(c))
  }, [actividades])

  // Franja "Últimos días": plazos que cierran en ≤ 7 días, el más próximo
  // primero. Solo en la vista sin filtrar (mismo criterio que el carrusel de
  // destacados en Eventos).
  const caducanPronto = useMemo(
    () =>
      categoria === null
        ? actividades
            .filter((a) => a.fechaLimite && diasHasta(a.fechaLimite) <= UMBRAL_CADUCA_PRONTO)
            .sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite))
        : [],
    [actividades, categoria]
  )

  // La lista general (por fecha de publicación, del hook) excluye lo que ya
  // está en la franja para no duplicar tarjetas.
  const listado = useMemo(() => {
    const enFranja = new Set(caducanPronto.map((a) => a.id))
    const base = categoria ? actividades.filter((a) => a.categoria === categoria) : actividades
    return base.filter((a) => !enFranja.has(a.id))
  }, [actividades, categoria, caducanPronto])

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

      {/* Últimos días: plazos que cierran ya, deslizables en horizontal.
          Estética de aviso (terracota), como la franja de Avisos en Noticias. */}
      {caducanPronto.length > 0 && (
        <section className="mt-6 animate-rise">
          <div className="mb-3 flex items-center gap-2">
            <MIcon name="timer" className="text-[18px] text-terracota" />
            <h2 className="gz-eyebrow text-terracota">Últimos días de plazo</h2>
          </div>
          <div className="hide-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
            {caducanPronto.map((a) => (
              <Link
                key={a.id}
                to={`/noticias/${a.id}`}
                className="min-w-[260px] max-w-[320px] flex-none snap-start border border-terracota bg-terracota-fondo p-4 transition-colors hover:bg-terracota/10"
              >
                <div className="flex items-center justify-between gap-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta">
                  <span className="text-mudo">{ETIQUETAS_ACTIVIDAD[a.categoria] || 'General'}</span>
                  <span className="flex items-center gap-1 text-terracota">
                    <MIcon name="timer" className="text-[13px]" />
                    {textoCuentaAtras(a.fechaLimite)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 font-serif-dm text-lg leading-tight text-tinta">
                  {a.titulo}
                </p>
                <p className="mt-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta">
                  Hasta el {formatearPlazo(a.fechaLimite)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

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

      {listado.length === 0 && caducanPronto.length === 0 && (
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
