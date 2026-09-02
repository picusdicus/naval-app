import { useState, useEffect } from 'react'
import MIcon from '../../MIcon.jsx'
import SelectorImagen from '../SelectorImagen.jsx'
import { optimizarImagen, validarImagen } from '../../../lib/imageOptimizer.js'
import { CATEGORIAS_EVENTO } from '../../../lib/eventos.js'

const CATEGORIAS = Object.keys(CATEGORIAS_EVENTO).sort()
const DISCIPLINAS_POR_CATEGORIA = {
  deporte: ['tenis', 'futbol', 'padel', 'basketball', 'natacion', 'atletismo', 'otro'],
}

export default function PanelImagenesGenericas() {
  const [imagenes, setImagenes] = useState([])
  const [cargando, setCargando] = useState(false)
  const [categoriaActiva, setCategoriaActiva] = useState(CATEGORIAS[0] || 'cultura')
  const [disciplinaActiva, setDisciplinaActiva] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  // Formulario de subida
  const [fichero, setFichero] = useState(null)
  const [autor, setAutor] = useState('')
  const [fuente, setFuente] = useState('')
  const [licencia, setLicencia] = useState('')
  const [descripcion, setDescripcion] = useState('')

  const cargarImagenes = async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/imagenes-evento-genericas')
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

  const handleSubir = async () => {
    if (!fichero) {
      alert('Selecciona una imagen')
      return
    }

    const errorValidacion = validarImagen(fichero, 3)
    if (errorValidacion) {
      alert(errorValidacion)
      return
    }

    setOcupado(true)
    try {
      const optimizada = await optimizarImagen(fichero, 1200)

      const res = await fetch('/api/admin/imagen-evento-generica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: fichero.name,
          tipo: optimizada.tipo,
          datos: optimizada.datos,
          categoria: categoriaActiva,
          disciplina: disciplinaActiva || null,
          autor: autor.trim() || null,
          fuente: fuente.trim() || null,
          licencia: licencia.trim() || null,
          descripcion: descripcion.trim() || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al subir')
      }

      // Limpiar formulario y recargar
      setFichero(null)
      setAutor('')
      setFuente('')
      setLicencia('')
      setDescripcion('')
      await cargarImagenes()
    } catch (error) {
      alert(`Error: ${error.message}`)
    } finally {
      setOcupado(false)
    }
  }

  const handleCambiarActivo = async (id, nuevoActivo) => {
    try {
      const res = await fetch(`/api/admin/imagen-evento-generica?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nuevoActivo }),
      })

      if (!res.ok) throw new Error('Error al actualizar')
      await cargarImagenes()
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
      await cargarImagenes()
    } catch (error) {
      alert(`Error: ${error.message}`)
    }
  }

  const disciplinas = DISCIPLINAS_POR_CATEGORIA[categoriaActiva] || []

  return (
    <div className="space-y-6">
      <div className="text-sm text-pardo">
        <p>Gestiona imágenes genéricas por categoría y disciplina.</p>
        <p className="mt-2">Nota: estas imágenes solo se muestran si MOSTRAR_IMAGENES_GENERICAS=true.</p>
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

          {disciplinas.length > 0 && (
            <div>
              <h3 className="mb-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta">
                Disciplina
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
                      alt={img.descripcion}
                      className="w-full aspect-square object-cover mb-2"
                    />
                    <div className="space-y-1 text-[10px]">
                      {img.descripcion && (
                        <p className="line-clamp-2 text-tinta">{img.descripcion}</p>
                      )}
                      {img.fuente && <p className="text-pardo">{img.fuente}</p>}
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

          {/* Formulario de subida */}
          <div className="border border-tinta bg-papel p-4">
            <h3 className="mb-3 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta">
              Subir nueva imagen
            </h3>
            <div className="space-y-3">
              <SelectorImagen
                etiqueta="Imagen"
                opcional={false}
                onSeleccionar={setFichero}
              />

              <div>
                <label className="block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo mb-1">
                  Autor
                </label>
                <input
                  type="text"
                  value={autor}
                  onChange={(e) => setAutor(e.target.value)}
                  placeholder="Nombre del autor"
                  className="w-full border border-tinta px-2 py-1 text-sm"
                />
              </div>

              <div>
                <label className="block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo mb-1">
                  Fuente (Pexels, Unsplash, etc.)
                </label>
                <input
                  type="text"
                  value={fuente}
                  onChange={(e) => setFuente(e.target.value)}
                  placeholder="Fuente de la imagen"
                  className="w-full border border-tinta px-2 py-1 text-sm"
                />
              </div>

              <div>
                <label className="block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo mb-1">
                  Licencia
                </label>
                <input
                  type="text"
                  value={licencia}
                  onChange={(e) => setLicencia(e.target.value)}
                  placeholder="CC BY, CC0, etc."
                  className="w-full border border-tinta px-2 py-1 text-sm"
                />
              </div>

              <div>
                <label className="block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo mb-1">
                  Descripción
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción breve (ej: pista y raqueta)"
                  rows="2"
                  className="w-full border border-tinta px-2 py-1 text-sm resize-none"
                />
              </div>

              <button
                onClick={handleSubir}
                disabled={ocupado || !fichero}
                className="w-full bg-terracota px-3 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel transition-colors hover:bg-tinta disabled:opacity-50"
              >
                {ocupado ? 'Subiendo...' : 'Guardar imagen'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
