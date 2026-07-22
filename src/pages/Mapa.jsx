import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import comerciosData from '../data/comercios.json'
import serviciosLocales from '../data/servicios-locales.json'
import { etiquetaCocina } from '../lib/cocinas.js'
import MapaComercios from '../components/directorio/MapaComercios.jsx'
import FiltrosCategoria from '../components/directorio/FiltrosCategoria.jsx'
import ComercioCard from '../components/directorio/ComercioCard.jsx'
import ComercioFila from '../components/directorio/ComercioFila.jsx'
import ComercioDetalle from '../components/directorio/ComercioDetalle.jsx'
import SugerirComercio from '../components/directorio/SugerirComercio.jsx'
import { buscarDirectorio } from '../lib/busqueda.js'
import { useDestacados } from '../lib/useDestacados.js'
import { useLazyLoad } from '../lib/useLazyLoad.js'
import CarruselDestacados from '../components/destacados/CarruselDestacados.jsx'
import HeroDestacadosDesktop from '../components/destacados/HeroDestacadosDesktop.jsx'
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

  // ?comercio=<id> abre la ficha directamente (lo usan las tarjetas de
  // destacados de la portada para aterrizar en el comercio concreto).
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const id = searchParams.get('comercio')
    if (!id) return
    const comercio = todos.find((c) => c.id === id)
    if (comercio) setSeleccionado(comercio)
  }, [searchParams, todos])

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

  // Comercios destacados (contratados). La franja solo se muestra en la vista
  // sin filtrar: con una categoría o búsqueda activa el usuario va a lo suyo.
  const { items: comerciosDestacados } = useDestacados({ tipo: 'comercio' })
  const conDestacados = !categoria && !busqueda && comerciosDestacados.length > 0

  // Lazy loading: mostrar 12 iniciales, cargar 12 más al hacer scroll
  const { items: comerciosVisibles, observerRef } = useLazyLoad(comercios, 12)

  // Al seleccionar un comercio, scroll la ficha a la vista dentro del contenedor de la
  // columna izquierda. En desktop el scroll es dentro del contenedor (lg:overflow-y-auto),
  // en móvil se usa scrollIntoView normal.
  useEffect(() => {
    if (seleccionado && detalleRef.current) {
      const container = columnRef.current
      if (container && esDesktop) {
        const detalle = detalleRef.current
        const detalleRect = detalle.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()

        // Posición del detalle relativa al contenedor
        const detalleTopRelative = detalleRect.top - containerRect.top + container.scrollTop
        const containerHeight = container.clientHeight
        const detalleHeight = detalle.clientHeight

        // Scroll para que el detalle aparezca justo debajo, con 16px de padding
        const newScrollTop = detalleTopRelative - 16

        container.scrollTo({ top: newScrollTop, behavior: 'smooth' })
      } else {
        detalleRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [seleccionado, esDesktop])

  return (
    <div className="flex flex-col">
      {/* Cabecera - FULL WIDTH */}
      <div className="flex flex-col gap-6 px-4 py-6 lg:px-0 lg:mb-6">
        <header className="gz-filete-doble pb-3">
          <div className="gz-label text-mudo">El directorio de</div>
          <h1 className="font-serif-dm text-seccion leading-none text-tinta">Comercios</h1>
        </header>
      </div>

      {/* Franja de comercios destacados - FULL WIDTH.
          Móvil: carrusel nativo con scroll-snap (todas las tarjetas).
          Escritorio: hero editorial con tarjetas grandes, cabecera y flechas. */}
      {conDestacados && (
        <section className="mb-6 px-4 lg:px-0">
          {/* Móvil */}
          <div className="md:hidden">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="gz-eyebrow">Comercios destacados</h2>
            </div>
            <CarruselDestacados
              items={comerciosDestacados}
              columnas={3}
              seccion="comercios"
              onItemClick={setSeleccionado}
            />
          </div>

          {/* Escritorio */}
          <div className="hidden md:block">
            <HeroDestacadosDesktop
              items={comerciosDestacados}
              eyebrow="Comercios destacados"
              titulo="Los negocios que dan vida al pueblo"
              onSeleccionar={setSeleccionado}
              onAnunciar={() => setSugiriendo(true)}
              seccion="comercios"
            />
          </div>
        </section>
      )}

      {/* Buscador y filtros - FULL WIDTH, ENCIMA de listado */}
      <div className="px-4 lg:px-0 py-6 border-y border-tinta">
        <FiltrosCategoria
          categoria={categoria}
          onCategoria={elegirCategoria}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
        />

        {categoria === 'restauracion' && cocinasDisponibles.length > 0 && (
          <div className="hide-scrollbar flex gap-2 overflow-x-auto py-3 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta">
            <button
              type="button"
              onClick={() => setCocinaFiltro(null)}
              className={`flex-none whitespace-nowrap px-3 py-2 transition-colors ${
                cocinaFiltro === null ? 'bg-terracota text-papel' : 'border border-filete text-pardo hover:bg-papel-calido'
              }`}
            >
              Todo tipo
            </button>
            {cocinasDisponibles.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCocinaFiltro(c)}
                className={`flex-none whitespace-nowrap px-3 py-2 transition-colors ${
                  cocinaFiltro === c ? 'bg-terracota text-papel' : 'border border-filete text-pardo hover:bg-papel-calido'
                }`}
              >
                {etiquetaCocina(c)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contenedor principal: listado + mapa sidebar */}
      <div className="flex flex-col lg:flex-row lg:gap-6 lg:px-0 px-4 pt-6">
        {/* Columna izquierda: buscador + lista de comercios */}
        <div
          ref={columnRef}
          className="hide-scrollbar flex flex-col gap-6 flex-1 lg:min-w-0"
        >
  
          <div className="flex items-center justify-between border-t border-tinta pt-3">
            <p className="gz-label text-mudo">
              {comercios.length} {comercios.length === 1 ? 'comercio' : 'comercios'}
            </p>
            <button
              type="button"
              onClick={() => setSugiriendo(true)}
              className="flex items-center gap-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota transition-opacity hover:opacity-80"
            >
              <MIcon name="add" className="text-[14px]" />
              ¿Falta un comercio?
            </button>
          </div>

          {esSugerencia && (
            <p className="flex items-start gap-2 border border-filete bg-papel-calido px-4 py-3 font-serif-spectral text-sm text-tinta-apagada">
              <MIcon name="lightbulb" className="mt-0.5 text-[18px] text-ocre" />
              <span>
                No encontramos «{termino}» exactamente. Quizá te interesen estos sitios para comer:
              </span>
            </p>
          )}

          {/* Lista de comercios (solo desktop) */}
          {esDesktop && comercios.length > 0 && (
            <>
              <div className="space-y-0">
                {comerciosVisibles.map((c) => (
                  <ComercioFila
                    key={c.id}
                    comercio={c}
                    onClick={() => setSeleccionado(c)}
                  />
                ))}
              </div>
              {/* Sentinel para lazy load */}
              <div ref={observerRef} className="h-4" />
              {seleccionado && comercios.some((c) => c.id === seleccionado.id) && (
                <div ref={detalleRef} className="mt-6 border-t-2 border-tinta pt-6">
                  <ComercioDetalle comercio={seleccionado} onCerrar={() => setSeleccionado(null)} />
                </div>
              )}
            </>
          )}

          {/* Lista de comercios (solo móvil) */}
          {!esDesktop && (
            <>
              <div>
                {comerciosVisibles.map((c) => (
                  <div key={c.id}>
                    <ComercioCard
                      comercio={c}
                      activo={seleccionado?.id === c.id}
                      onClick={() => setSeleccionado(c)}
                    />
                    {seleccionado?.id === c.id && (
                      <div ref={detalleRef} className="py-3">
                        <ComercioDetalle comercio={c} onCerrar={() => setSeleccionado(null)} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Sentinel para lazy load */}
              <div ref={observerRef} className="h-4" />
            </>
          )}

          {comercios.length === 0 && (
            <p className="border border-dashed border-filete-punteado p-8 text-center font-serif-spectral text-sm text-pardo">
              No hay comercios que coincidan con tu búsqueda.
            </p>
          )}

          {/* Footer - sticky inferior */}
          <div className="mt-auto pt-6 border-t border-tinta">
            <p className="text-center font-mono-ibm text-[10px] text-mudo mb-3">
              Datos © colaboradores de OpenStreetMap
            </p>
          </div>
        </div>

        {/* Sidebar derecha: mapa sticky */}
        {esDesktop && (
          <div className="lg:w-2/5 lg:flex-shrink-0">
            <div className="lg:sticky lg:top-28 lg:h-96 border-2 border-tinta rounded">
              <MapaComercios
                comercios={enMapa}
                seleccionado={seleccionado}
                onSeleccionar={setSeleccionado}
              />
            </div>
          </div>
        )}
      </div>

      {sugiriendo && <SugerirComercio onCerrar={() => setSugiriendo(false)} />}
    </div>
  )
}
