import { useMemo, useState } from 'react'
import comerciosData from '../data/comercios.json'
import serviciosLocales from '../data/servicios-locales.json'
import { CATEGORIAS } from '../lib/categorias.js'
import { etiquetaCocina } from '../lib/cocinas.js'
import MapaComercios from '../components/directorio/MapaComercios.jsx'
import FiltrosCategoria from '../components/directorio/FiltrosCategoria.jsx'
import ComercioCard from '../components/directorio/ComercioCard.jsx'
import ComercioDetalle from '../components/directorio/ComercioDetalle.jsx'
import SugerirComercio from '../components/directorio/SugerirComercio.jsx'
import { IconPlus } from '../components/icons.jsx'

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
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold text-vino">Mapa y directorio</h1>
        <p className="mt-1 text-sm text-tinta-muted">
          Comercios, bares y servicios de Navalcarnero sobre el mapa. Datos de OpenStreetMap.
        </p>
      </header>

      <FiltrosCategoria
        categoria={categoria}
        onCategoria={elegirCategoria}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
      />

      {categoria === 'restauracion' && cocinasDisponibles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCocinaFiltro(null)}
            className={`nv-chip flex-none transition-colors ${
              cocinaFiltro === null
                ? 'bg-oro text-white'
                : 'bg-white text-tinta-muted shadow-soft hover:text-oro-dark'
            }`}
          >
            Todo tipo
          </button>
          {cocinasDisponibles.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCocinaFiltro(c)}
              className={`nv-chip flex-none transition-colors ${
                cocinaFiltro === c
                  ? 'bg-oro text-white'
                  : 'bg-white text-tinta-muted shadow-soft hover:text-oro-dark'
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
        <p className="text-sm text-tinta-muted">
          {comercios.length} {comercios.length === 1 ? 'comercio' : 'comercios'}
        </p>
        <button
          type="button"
          onClick={() => setSugiriendo(true)}
          className="flex items-center gap-1.5 rounded-full bg-vino px-3 py-1.5 text-xs font-medium text-crema"
        >
          <IconPlus className="h-4 w-4" />
          ¿Falta un comercio?
        </button>
      </div>

      {sugiriendo && <SugerirComercio onCerrar={() => setSugiriendo(false)} />}

      <div className="space-y-2">
        {comercios.map((c) => (
          <ComercioCard
            key={c.id}
            comercio={c}
            activo={seleccionado?.id === c.id}
            onClick={() => setSeleccionado(c)}
          />
        ))}
        {comercios.length === 0 && (
          <p className="rounded-3xl border border-dashed border-vino/20 bg-white p-6 text-center text-sm text-tinta-muted">
            No hay comercios que coincidan con tu búsqueda.
          </p>
        )}
      </div>

      <p className="text-center text-[11px] text-tinta-muted">
        Datos © colaboradores de OpenStreetMap
      </p>
    </div>
  )
}
