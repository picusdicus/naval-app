import { useState, useEffect, useContext } from 'react'
import MIcon from '../../MIcon.jsx'
import { CATEGORIAS_EVENTO, SUBTIPOS_CULTURALES } from '../../../lib/eventos.js'
import { RecargarGenericasContext } from '../../../lib/GenericasEventoContext.jsx'
import FormularioImagenGenerica from './FormularioImagenGenerica.jsx'

const CATEGORIAS = Object.keys(CATEGORIAS_EVENTO).sort()
// Debe coincidir con lo que devuelve disciplinaDeEvento() (src/lib/eventos.js).
const DISCIPLINAS_POR_CATEGORIA = {
  deporte: ['tenis', 'futbol', 'padel', 'baloncesto', 'petanca', 'ajedrez', 'tenis-de-mesa', 'tiro-al-plato', 'natacion', 'atletismo'],
  // Los subtipos culturales describen la forma del acto y valen igual dentro
  // de cultura y de fiestas (la verbena con DJ es de fiestas, pero la foto que
  // le pega es la de un DJ): se guardan aquí una sola vez.
  cultura: SUBTIPOS_CULTURALES,
  // Actos de registro religioso (novenas, misas, procesiones): solo reciben
  // fotos de este subtipo, nunca las festivas generales.
  fiestas: ['religiosa'],
}

const AVISO_POR_CATEGORIA = {
  cultura:
    'Estas imágenes las usan también los actos culturales programados dentro de fiestas (una verbena con orquesta, teatro en la plaza).',
  fiestas:
    'Solo los actos que no son culturales (pregón, encierros, fuegos). Un acto de fiestas con orquesta, DJ o teatro usa las imágenes de Cultura.',
}

export default function PanelImagenesGenericas() {
  const recargarGenericas = useContext(RecargarGenericasContext)
  const [imagenes, setImagenes] = useState([])
  const [cargando, setCargando] = useState(false)
  const [categoriaActiva, setCategoriaActiva] = useState(CATEGORIAS[0] || 'cultura')
  const [disciplinaActiva, setDisciplinaActiva] = useState(null)

  const cargarImagenes = async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/admin/imagen-evento-generica')
      if (!res.ok) throw new Error('No se pudieron cargar las imágenes')
      const { imagenes } = await res.json()
      setImagenes(imagenes)
    } catch (error) {
      console.error('Error cargando imágenes:', error)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarImagenes()
  }, [])

  const imagenesFiltradas = imagenes.filter(
    (img) =>
      img.categoria === categoriaActiva &&
      (!disciplinaActiva || img.disciplina === disciplinaActiva)
  )

  // Estado local con la fila devuelta por la API en POST/PATCH/DELETE: un GET
  // inmediato tras escribir puede no ver la fila todavía (lectura por otra
  // conexión HTTP de Neon). El Context público se recarga aparte para que las
  // miniaturas de la agenda/panel de eventos reflejen el cambio.
  const handleSubida = (fila) => {
    setImagenes((prev) => [...prev, fila])
    recargarGenericas()
  }

  const handleCambiarActivo = async (id, nuevoActivo) => {
    try {
      const res = await fetch(`/api/admin/imagen-evento-generica?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nuevoActivo }),
      })

      if (!res.ok) throw new Error('Error al actualizar')
      const fila = await res.json()
      setImagenes((prev) => prev.map((img) => (img.id === id ? { ...img, ...fila } : img)))
      recargarGenericas()
    } catch (error) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleBorrar = async (id) => {
    if (!confirm('¿Borrar esta imagen?')) return

    try {
      const res = await fetch(`/api/admin/imagen-evento-generica?id=${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Error al borrar')
      setImagenes((prev) => prev.filter((img) => img.id !== id))
      recargarGenericas()
    } catch (error) {
      alert(`Error: ${error.message}`)
    }
  }

  const disciplinas = DISCIPLINAS_POR_CATEGORIA[categoriaActiva] || []

  return (
    <div className="space-y-6">
      <div className="text-sm text-pardo">
        <p>Gestiona imágenes genéricas por categoría y subtipo.</p>
        <p className="mt-2">
          Un evento sin cartel propio muestra una de estas (elegida de forma estable por evento):
          las de su subtipo si el título, la subcategoría o la descripción lo dejan reconocer, o
          las generales de su categoría si no. Con varias imágenes en un subtipo, los eventos se
          reparten entre ellas. Una categoría sin imágenes activas se pinta con el degradado de
          siempre. En la pestaña Eventos, cada fila indica qué subtipo le toca y permite subir
          una imagen para él sin venir aquí.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Navegación izquierda */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta">
              Categoría
            </h3>
            <div className="space-y-1">
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategoriaActiva(cat)
                    setDisciplinaActiva(null)
                  }}
                  className={`block w-full text-left px-2 py-1 text-sm transition-colors ${
                    categoriaActiva === cat
                      ? 'bg-terracota text-papel'
                      : 'text-tinta hover:bg-papel-calido'
                  }`}
                >
                  {CATEGORIAS_EVENTO[cat].nombre}
                </button>
              ))}
            </div>
          </div>

          {AVISO_POR_CATEGORIA[categoriaActiva] && (
            <p className="border-l-2 border-filete pl-2 font-serif-spectral text-xs text-pardo">
              {AVISO_POR_CATEGORIA[categoriaActiva]}
            </p>
          )}

          {disciplinas.length > 0 && (
            <div>
              <h3 className="mb-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta">
                Subtipo
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => setDisciplinaActiva(null)}
                  className={`block w-full text-left px-2 py-1 text-sm transition-colors ${
                    disciplinaActiva === null
                      ? 'bg-terracota text-papel'
                      : 'text-tinta hover:bg-papel-calido'
                  }`}
                >
                  Todas
                </button>
                {disciplinas.map((dis) => (
                  <button
                    key={dis}
                    onClick={() => setDisciplinaActiva(dis)}
                    className={`block w-full text-left px-2 py-1 text-sm transition-colors ${
                      disciplinaActiva === dis
                        ? 'bg-terracota text-papel'
                        : 'text-tinta hover:bg-papel-calido'
                    }`}
                  >
                    {dis}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Galería y formulario derecha */}
        <div className="lg:col-span-2 space-y-6">
          {/* Galería */}
          <div>
            <h3 className="mb-3 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta">
              Imágenes de {CATEGORIAS_EVENTO[categoriaActiva].nombre}
              {disciplinaActiva && ` · ${disciplinaActiva}`} ({imagenesFiltradas.length})
            </h3>
            {cargando ? (
              <p className="text-pardo">Cargando...</p>
            ) : imagenesFiltradas.length === 0 ? (
              <p className="text-pardo">Sin imágenes</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {imagenesFiltradas.map((img) => (
                  <div key={img.id} className="border border-tinta bg-papel p-2">
                    <img
                      src={img.url}
                      alt={img.descripcion || ''}
                      className={`w-full aspect-square object-cover mb-2 ${img.activo ? '' : 'opacity-40'}`}
                    />
                    <div className="space-y-1 text-[10px]">
                      {img.descripcion && (
                        <p className="line-clamp-2 text-tinta">{img.descripcion}</p>
                      )}
                      {(img.disciplina || img.fuente) && (
                        <p className="text-pardo">
                          {[img.disciplina, img.fuente].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={img.activo}
                            onChange={(e) => handleCambiarActivo(img.id, e.target.checked)}
                            className="w-3 h-3"
                          />
                          <span className="text-pardo">Activa</span>
                        </label>
                        <button
                          onClick={() => handleBorrar(img.id)}
                          className="ml-auto text-terracota hover:text-tinta"
                          title="Borrar"
                        >
                          <MIcon name="delete" className="text-[14px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formulario de subida: sube a la categoría/disciplina seleccionadas */}
          <div className="border border-tinta bg-papel p-4">
            <h3 className="mb-3 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta">
              Subir nueva imagen · {CATEGORIAS_EVENTO[categoriaActiva].nombre} ·{' '}
              {disciplinaActiva || 'general'}
            </h3>
            <FormularioImagenGenerica
              key={`${categoriaActiva}/${disciplinaActiva || ''}`}
              categoria={categoriaActiva}
              disciplina={disciplinaActiva}
              onSubida={handleSubida}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
