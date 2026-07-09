import { useEffect, useMemo, useRef, useState } from 'react'
import comerciosData from '../data/comercios.json'
import serviciosLocales from '../data/servicios-locales.json'
import { etiquetaCocina } from '../lib/cocinas.js'
import MapaComercios from '../components/directorio/MapaComercios.jsx'
import FiltrosCategoria from '../components/directorio/FiltrosCategoria.jsx'
import ComercioCard from '../components/directorio/ComercioCard.jsx'
import ComercioDetalle from '../components/directorio/ComercioDetalle.jsx'
import SugerirComercio from '../components/directorio/SugerirComercio.jsx'
import { buscarDirectorio } from '../lib/busqueda.js'
import MIcon from '../components/MIcon.jsx'

// Hook: ¿el viewport cumple el media query? Se usa para montar el mapa solo en
// escritorio (evita inicializar Leaflet en un contenedor oculto en móvil).
function useMediaQuery(query) {
  const [match, setMatch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatch(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return match
}

export default function Mapa() {
  const [categoria, setCategoria] = useState(null)
  const [cocinaFiltro, setCocinaFiltro] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [sugiriendo, setSugiriendo] = useState(false)
  const detalleRef = useRef(null)
  const columnRef = useRef(null)

  // El mapa (columna derecha) solo existe en escritorio (>= 1024px).
  const esDesktop = useMediaQuery('(min-width: 1024px)')

  // OSM (con coordenadas) + servicios locales curados (sin ubicación fija).
  const todos = useMemo(() => [...comerciosData, ...serviciosLocales], [])

  // Al cambiar de categoría, se descarta el sub-filtro de tipo de cocina.
  function elegirCategoria(cat) {
    setCategoria(cat)
    setCocinaFiltro(null)
  }

  // Tipos de cocina disponibles entre los locales de restauración.
  const cocinasDisponibles = useMemo(() => {
    const set = new Set()
    for (const c of todos) {
      if (c.categoria === 'restauracion' && c.cocina) c.cocina.forEach((v) => set.add(v))
    }
    return [...set].sort((a, b) => etiquetaCocina(a).localeCompare(etiquetaCocina(b), 'es'))
  }, [todos])

  // Base filtrada por los controles no textuales (categoría / tipo de cocina).
  const baseFiltrada = useMemo(
    () =>
      todos.filter((c) => {
        if (categoria && c.categoria !== categoria) return false
        if (cocinaFiltro && !(c.cocina || []).includes(cocinaFiltro)) return false
        return true
      }),
    [todos, categoria, cocinaFiltro],
  )

  // Búsqueda con intención: mapea "sushi", "hamburguesas", "tapas"… a comercios
  // relevantes, y sugiere alternativas si no hay coincidencia exacta.
  const { lista: comercios, esSugerencia, termino } = useMemo(
    () => buscarDirectorio(baseFiltrada, busqueda),
    [baseFiltrada, busqueda],
  )

  // Solo los que tienen coordenadas se pintan en el mapa.
  const enMapa = useMemo(
    () => comercios.filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number'),
    [comercios],
  )

  // Al seleccionar un comercio, scroll la ficha a la vista dentro del contenedor de la
  // columna izquierda. En desktop el scroll es dentro del contenedor (lg:overflow-y-auto),
  // en móvil se usa scrollIntoView normal.
  useEffect(() => {
    if (seleccionado && detalleRef.current) {
      const container = columnRef.current
      if (container && esDesktop) {
        const detalle = detalleRef.current
        const containerTop = container.scrollTop
        const containerHeight = container.clientHeight
        const detalleTop = detalle.offsetTop
        const detalleHeight = detalle.clientHeight

        const newScrollTop =
          detalleTop + detalleHeight - containerHeight + 16 > containerTop
            ? detalleTop - 16
            : containerTop

        container.scrollTo({ top: newScrollTop, behavior: 'smooth' })
      } else {
        detalleRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [seleccionado, esDesktop])

  return (
    <div className="lg:flex lg:h-[calc(100vh-7rem)] lg:gap-6">
      {/* Columna izquierda: buscador + chips + lista (scroll independiente en
          desktop; flujo normal de la página en móvil). */}
      <div
        ref={columnRef}
        className="hide-scrollbar flex flex-col gap-6 lg:h-full lg:w-2/5 lg:min-w-0 lg:overflow-y-auto lg:pr-2"
      >
        <header>
          <h1 className="font-display text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
            Guía local
          </h1>
          <p className="mt-1 text-on-surface-variant">
            Encuentra los mejores rincones de Navalcarnero. Datos de OpenStreetMap.
          </p>
        </header>

        <FiltrosCategoria
          categoria={categoria}
          onCategoria={elegirCategoria}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
        />

        {categoria === 'restauracion' && cocinasDisponibles.length > 0 && (
          <div className="hide-scrollbar flex gap-2 overflow-x-auto py-1">
            <button
              type="button"
              onClick={() => setCocinaFiltro(null)}
              className={`flex-none whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                cocinaFiltro === null
                  ? 'bg-secondary text-on-secondary shadow-md'
                  : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Todo tipo
            </button>
            {cocinasDisponibles.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCocinaFiltro(c)}
                className={`flex-none whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  cocinaFiltro === c
                    ? 'bg-secondary text-on-secondary shadow-md'
                    : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {etiquetaCocina(c)}
              </button>
            ))}
          </div>
        )}

        {/* Ficha del comercio seleccionado (teléfono, horario, web, cómo llegar).
            Se abre justo debajo de la tarjeta seleccionada con smooth scroll. */}
        {seleccionado && (
          <div ref={detalleRef}>
            <ComercioDetalle comercio={seleccionado} onCerrar={() => setSeleccionado(null)} />
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-on-surface-variant">
            {comercios.length} {comercios.length === 1 ? 'comercio' : 'comercios'}
          </p>
          <button
            type="button"
            onClick={() => setSugiriendo(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition-all hover:bg-primary-container active:scale-95"
          >
            <MIcon name="add" className="text-[16px]" />
            ¿Falta un comercio?
          </button>
        </div>

        {esSugerencia && (
          <p className="flex items-start gap-2 rounded-lg bg-surface-container-high px-4 py-3 text-sm text-on-surface-variant">
            <MIcon name="lightbulb" className="mt-0.5 text-[18px] text-secondary" />
            <span>
              No encontramos «{termino}» exactamente. Quizá te interesen estos sitios para comer:
            </span>
          </p>
        )}

        <div className="grid grid-cols-1 gap-3">
          {comercios.map((c) => (
            <ComercioCard
              key={c.id}
              comercio={c}
              activo={seleccionado?.id === c.id}
              onClick={() => setSeleccionado(c)}
            />
          ))}
          {comercios.length === 0 && (
            <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center text-sm text-on-surface-variant">
              No hay comercios que coincidan con tu búsqueda.
            </p>
          )}
        </div>

        <p className="text-center text-[11px] text-on-surface-variant">
          Datos © colaboradores de OpenStreetMap
        </p>
      </div>

      {/* Columna derecha: mapa fijo, solo en escritorio. */}
      {esDesktop && (
        <div className="lg:h-full lg:w-3/5">
          <MapaComercios
            comercios={enMapa}
            seleccionado={seleccionado}
            onSeleccionar={setSeleccionado}
          />
        </div>
      )}

      {sugiriendo && <SugerirComercio onCerrar={() => setSugiriendo(false)} />}
    </div>
  )
}
