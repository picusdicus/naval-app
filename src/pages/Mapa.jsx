import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import comerciosData from '../data/comercios.json'
import serviciosLocales from '../data/servicios-locales.json'
import { CATEGORIAS } from '../lib/categorias.js'
import { etiquetaCocina } from '../lib/cocinas.js'
import MapaComercios from '../components/directorio/MapaComercios.jsx'
import FiltrosCategoria from '../components/directorio/FiltrosCategoria.jsx'
import ComercioCard from '../components/directorio/ComercioCard.jsx'
import ComercioDetalle from '../components/directorio/ComercioDetalle.jsx'
import SugerirComercio from '../components/directorio/SugerirComercio.jsx'
import LandingComercios from '../components/directorio/LandingComercios.jsx'
import SubcategoriasComercios from '../components/directorio/SubcategoriasComercios.jsx'
import { infoSubtipo } from '../lib/subtipos.js'
import { buscarDirectorio } from '../lib/busqueda.js'
import { useDestacados } from '../lib/useDestacados.js'
import { useLazyLoad } from '../lib/useLazyLoad.js'
import { useReclamacionesComercios } from '../lib/useReclamacionesComercios.js'
import { usePerfilesComercios } from '../lib/usePerfilesComercios.js'
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
  const [cocinaFiltro, setCocinaFiltro] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [sugiriendo, setSugiriendo] = useState(false)
  const detalleRef = useRef(null)
  const columnRef = useRef(null)

  // Cargar estado de reclamaciones de comercios
  const { reclamaciones, esReclamacionPendiente, esReclamacionAprobada } = useReclamacionesComercios()

  // Perfiles enriquecidos (foto, descripción): marcan qué fichas están reclamadas
  const todos = useMemo(() => [...comerciosData, ...serviciosLocales], [])
  const { obtenerPerfil } = usePerfilesComercios()

  // El mapa (columna derecha) solo existe en escritorio (>= 1024px).
  const esDesktop = useMediaQuery('(min-width: 1024px)')

  // La vista se deriva de la URL (nada de estado duplicado):
  //   /comercios                          → landing por tipo de negocio
  //   /comercios?categoria=<id>           → tarjetas de subcategoría de esa categoría
  //   /comercios?categoria=<id>&sub=<s>   → listado de esa subcategoría
  //   /comercios?categoria=<id>&ver=todos → listado completo de la categoría
  //   /comercios?ver=todos[&q=…]          → listado completo (con búsqueda opcional)
  //   /comercios?comercio=<id>            → listado con la ficha abierta (deep-link)
  const [searchParams, setSearchParams] = useSearchParams()
  const categoriaParam = searchParams.get('categoria')
  const categoria = CATEGORIAS[categoriaParam] ? categoriaParam : null
  const sub = categoria ? searchParams.get('sub') : null
  const busqueda = searchParams.get('q') ?? ''
  const verTodos = searchParams.get('ver') === 'todos'
  const comercioParam = searchParams.get('comercio')
  const vista =
    !categoria && !verTodos && !busqueda && !comercioParam
      ? 'landing'
      : categoria && !sub && !verTodos && !busqueda && !comercioParam
        ? 'subcategorias'
        : 'listado'

  // ?comercio=<id> abre la ficha directamente (lo usan las tarjetas de
  // destacados para aterrizar en el comercio concreto).
  useEffect(() => {
    if (!comercioParam) return
    const comercio = todos.find((c) => c.id === comercioParam)
    if (comercio) setSeleccionado(comercio)
  }, [comercioParam, todos])

  // Al cambiar de categoría (también por atrás/adelante del historial), se
  // descarta el sub-filtro de tipo de cocina.
  useEffect(() => {
    setCocinaFiltro(null)
  }, [categoria])

  // Al salir del listado no debe quedar una ficha abierta de la visita anterior.
  useEffect(() => {
    if (vista !== 'listado') setSeleccionado(null)
  }, [vista])

  // Chips de FiltrosCategoria dentro del listado. `replace`: los cambios de
  // filtro no ensucian el historial — atrás vuelve a la vista anterior en un
  // paso. Se ancla `ver=todos` para seguir en el listado (sin pasar por las
  // tarjetas de subcategoría ni volver a la landing).
  function elegirCategoria(cat) {
    const next = new URLSearchParams()
    if (cat) next.set('categoria', cat)
    next.set('ver', 'todos')
    if (busqueda) next.set('q', busqueda)
    setSearchParams(next, { replace: true })
  }

  // Input de búsqueda dentro del listado (cada tecla, con `replace`). Conserva
  // la categoría y la subcategoría activas; borrar el texto no cambia de vista.
  function cambiarBusqueda(texto) {
    const next = new URLSearchParams()
    if (categoria) next.set('categoria', categoria)
    if (sub) next.set('sub', sub)
    else next.set('ver', 'todos')
    if (texto) next.set('q', texto)
    setSearchParams(next, { replace: true })
  }

  // Buscador de la landing (push: atrás vuelve a la landing).
  function buscarDesdeLanding(texto) {
    const next = new URLSearchParams({ ver: 'todos' })
    if (texto.trim()) next.set('q', texto.trim())
    setSearchParams(next)
  }

  // Buscador de la vista de subcategorías: busca dentro de la categoría (push).
  function buscarEnCategoria(texto) {
    const next = new URLSearchParams({ categoria, ver: 'todos' })
    if (texto.trim()) next.set('q', texto.trim())
    setSearchParams(next)
  }

  // Destacados de la landing: abrir la ficha exige pasar a la vista de listado.
  // El efecto de ?comercio= se encarga de seleccionarla.
  function seleccionarDesdeDestacados(comercio) {
    setSearchParams({ comercio: comercio.id })
  }

  // Tipos de cocina disponibles entre los locales de restauración.
  const cocinasDisponibles = useMemo(() => {
    const set = new Set()
    for (const c of todos) {
      if (c.categoria === 'restauracion' && c.cocina) c.cocina.forEach((v) => set.add(v))
    }
    return [...set].sort((a, b) => etiquetaCocina(a).localeCompare(etiquetaCocina(b), 'es'))
  }, [todos])

  // Base filtrada por los controles no textuales (categoría / subcategoría /
  // tipo de cocina).
  const baseFiltrada = useMemo(
    () =>
      todos.filter((c) => {
        if (categoria && c.categoria !== categoria) return false
        if (sub && c.subtipo !== sub) return false
        if (cocinaFiltro && !(c.cocina || []).includes(cocinaFiltro)) return false
        return true
      }),
    [todos, categoria, sub, cocinaFiltro],
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

  // Comercios destacados (contratados). La franja es exclusiva de la landing:
  // en el listado el usuario va a lo suyo.
  const { items: comerciosDestacados } = useDestacados({ tipo: 'comercio' })
  const conDestacados = vista === 'landing' && comerciosDestacados.length > 0

  // Total de comercios por categoría, para las tarjetas de la landing.
  const conteosPorCategoria = useMemo(() => {
    const conteos = {}
    for (const c of todos) conteos[c.categoria] = (conteos[c.categoria] || 0) + 1
    return conteos
  }, [todos])

  // Subtipos presentes en la categoría activa, en orden alfabético, para las
  // tarjetas de subcategoría.
  const subtiposDeCategoria = useMemo(() => {
    if (!categoria) return []
    const conteos = {}
    for (const c of todos) {
      if (c.categoria === categoria) conteos[c.subtipo] = (conteos[c.subtipo] || 0) + 1
    }
    return Object.entries(conteos)
      .map(([subtipo, total]) => ({ subtipo, total }))
      .sort((a, b) => infoSubtipo(a.subtipo).nombre.localeCompare(infoSubtipo(b.subtipo).nombre, 'es'))
  }, [todos, categoria])

  // Lazy loading: mostrar 12 iniciales, cargar 12 más al hacer scroll
  const { items: comerciosVisibles, observerRef } = useLazyLoad(comercios, 12)

  // Cabecera del listado: de qué es la lista y cuántos hay (de ellos, cuántos
  // con ficha reclamada — el sello "verificado" de cada fila).
  const tituloListado = sub
    ? infoSubtipo(sub).nombre
    : categoria
      ? CATEGORIAS[categoria].nombre
      : busqueda
        ? 'Resultados'
        : 'Todos los comercios'
  const reclamados = useMemo(
    () => comercios.filter((c) => obtenerPerfil(c.id)).length,
    [comercios, obtenerPerfil],
  )

  // Al seleccionar un comercio, scroll la ficha a la vista dentro del contenedor de la
  // columna izquierda. En desktop el scroll es dentro del contenedor (lg:overflow-y-auto),
  // en móvil se usa scrollIntoView normal.
  useEffect(() => {
    if (!seleccionado || !detalleRef.current) return
    // `nearest`: la ficha se abre pegada a su fila, así que solo se desplaza la
    // página si se ha quedado fuera de pantalla — sin dar un salto cuando ya
    // se veía entera.
    detalleRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [seleccionado])

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
              onItemClick={seleccionarDesdeDestacados}
            />
          </div>

          {/* Escritorio */}
          <div className="hidden md:block">
            <HeroDestacadosDesktop
              items={comerciosDestacados}
              eyebrow="Comercios destacados"
              titulo="Los negocios que dan vida al pueblo"
              onSeleccionar={seleccionarDesdeDestacados}
              onAnunciar={() => setSugiriendo(true)}
              seccion="comercios"
            />
          </div>
        </section>
      )}

      {/* Landing por tipo de negocio (sin filtros activos) o vista de listado */}
      {vista === 'landing' ? (
        <LandingComercios
          total={todos.length}
          conteos={conteosPorCategoria}
          onBuscar={buscarDesdeLanding}
          onSugerir={() => setSugiriendo(true)}
        />
      ) : (
        <>
      {/* Migas: landing ← categoría ← subcategoría */}
      <div className="px-4 lg:px-0 pb-3">
        <Link
          to="/comercios"
          className="inline-flex items-center gap-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota transition-opacity hover:opacity-80"
        >
          <MIcon name="arrow_back" className="text-[14px]" />
          Todas las categorías
        </Link>
        {categoria && vista === 'listado' ? (
          <Link
            to={`/comercios?categoria=${categoria}`}
            className="ml-3 gz-label text-terracota transition-opacity hover:opacity-80"
          >
            / {CATEGORIAS[categoria].nombre}
          </Link>
        ) : categoria ? (
          <span className="ml-3 gz-label text-mudo">/ {CATEGORIAS[categoria].nombre}</span>
        ) : null}
        {sub && vista === 'listado' && (
          <span className="ml-3 gz-label text-mudo">/ {infoSubtipo(sub).nombre}</span>
        )}
      </div>

      {vista === 'subcategorias' ? (
        <SubcategoriasComercios
          categoria={CATEGORIAS[categoria]}
          subtipos={subtiposDeCategoria}
          onBuscar={buscarEnCategoria}
        />
      ) : (
        <>
      {/* Buscador y filtros - FULL WIDTH, ENCIMA de listado */}
      <div className="px-4 lg:px-0 py-6 border-y border-tinta">
        <FiltrosCategoria
          categoria={categoria}
          onCategoria={elegirCategoria}
          busqueda={busqueda}
          onBusqueda={cambiarBusqueda}
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
  
          {/* Cabecera del listado: título de la lista + recuento.
              Móvil: una línea mono. Escritorio: titular serif y recuento. */}
          <div>
            <div className="flex items-baseline justify-between gap-3 border-b-2 border-tinta pb-2 lg:pb-3">
              <h2 className="hidden font-serif-dm text-2xl leading-none text-tinta lg:block">
                {tituloListado}
              </h2>
              <p className="gz-label truncate text-mudo lg:hidden">
                {tituloListado} · {comercios.length}
              </p>
              <p className="hidden flex-none gz-label text-mudo lg:block">
                {comercios.length} {comercios.length === 1 ? 'comercio' : 'comercios'}
                {reclamados > 0 && ` · ${reclamados} ${reclamados === 1 ? 'reclamado' : 'reclamados'}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSugiriendo(true)}
              className="ml-auto mt-2 flex items-center gap-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota transition-opacity hover:opacity-80"
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

          {/* Listado: la misma fila en móvil y escritorio, y la ficha en línea
              justo bajo el comercio seleccionado (acordeón) en ambos — al final
              de la lista quedaba lejos de la fila que la abría. */}
          {comercios.length > 0 && (
            <>
              <div>
                {comerciosVisibles.map((c) => (
                  <div key={c.id}>
                    <ComercioCard
                      comercio={c}
                      activo={seleccionado?.id === c.id}
                      onClick={() => setSeleccionado(c)}
                      fotoPerfil={obtenerPerfil(c.id)}
                    />
                    {seleccionado?.id === c.id && (
                      <div ref={detalleRef} className="py-3">
                        <ComercioDetalle
                          comercio={c}
                          onCerrar={() => setSeleccionado(null)}
                          esReclamacionPendiente={esReclamacionPendiente(c.id)}
                          tieneAprobada={esReclamacionAprobada(c.id)}
                        />
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
        </>
      )}
        </>
      )}

      {sugiriendo && <SugerirComercio onCerrar={() => setSugiriendo(false)} />}
    </div>
  )
}
