import { useMemo, useState } from 'react'
import comerciosData from '../data/comercios.json'
import serviciosLocales from '../data/servicios-locales.json'
import { etiquetaCocina } from '../lib/cocinas.js'
import MapaComercios from '../components/directorio/MapaComercios.jsx'
import FiltrosCategoria from '../components/directorio/FiltrosCategoria.jsx'
import ComercioCard from '../components/directorio/ComercioCard.jsx'
import ComercioDetalle from '../components/directorio/ComercioDetalle.jsx'
import SugerirComercio from '../components/directorio/SugerirComercio.jsx'
import MIcon from '../components/MIcon.jsx'

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export default function Mapa() {
  const [categoria, setCategoria] = useState(null)
  const [cocinaFiltro, setCocinaFiltro] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [sugiriendo, setSugiriendo] = useState(false)

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

  const comercios = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return todos.filter((c) => {
      if (categoria && c.categoria !== categoria) return false
      if (cocinaFiltro && !(c.cocina || []).includes(cocinaFiltro)) return false
      if (q && !normalizar(c.nombre).includes(q)) return false
      return true
    })
  }, [todos, categoria, cocinaFiltro, busqueda])

  // Solo los que tienen coordenadas se pintan en el mapa.
  const enMapa = useMemo(
    () => comercios.filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number'),
    [comercios],
  )

  return (
    <div className="space-y-6">
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

      <MapaComercios
        comercios={enMapa}
        seleccionado={seleccionado}
        onSeleccionar={setSeleccionado}
      />

      {seleccionado && (
        <ComercioDetalle comercio={seleccionado} onCerrar={() => setSeleccionado(null)} />
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

      {sugiriendo && <SugerirComercio onCerrar={() => setSugiriendo(false)} />}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {comercios.map((c) => (
          <ComercioCard
            key={c.id}
            comercio={c}
            activo={seleccionado?.id === c.id}
            onClick={() => setSeleccionado(c)}
          />
        ))}
        {comercios.length === 0 && (
          <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center text-sm text-on-surface-variant md:col-span-2">
            No hay comercios que coincidan con tu búsqueda.
          </p>
        )}
      </div>

      <p className="text-center text-[11px] text-on-surface-variant">
        Datos © colaboradores de OpenStreetMap
      </p>
    </div>
  )
}
