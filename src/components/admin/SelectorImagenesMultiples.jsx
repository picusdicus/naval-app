import { useRef, useState } from 'react'
import MIcon from '../MIcon.jsx'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 3 * 1024 * 1024

function aBase64(fichero) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result))
    lector.onerror = () => reject(new Error('No se pudo leer el fichero.'))
    lector.readAsDataURL(fichero)
  })
}

export default function SelectorImagenesMultiples({
  imagenes = [],
  onCargar,
  maxImagenes = 5,
  etiqueta = 'Fotos adicionales'
}) {
  const fileInputRef = useRef(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const handleClick = () => {
    if (imagenes.length < maxImagenes) {
      fileInputRef.current?.click()
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setCargando(true)

    try {
      // Validar tipo
      if (!TIPOS.includes(file.type)) {
        throw new Error('Formato no admitido. Usa JPG, PNG o WebP.')
      }

      // Validar tamaño
      if (file.size > MAX_BYTES) {
        throw new Error('Archivo demasiado grande (máx 3 MB)')
      }

      // Leer archivo como data URL
      const dataUrl = await aBase64(file)

      // Agregar imagen
      const nuevasImagenes = [...imagenes, dataUrl]
      onCargar(nuevasImagenes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }

    // Limpiar input
    e.target.value = ''
  }

  const eliminarImagen = (idx) => {
    const nuevasImagenes = imagenes.filter((_, i) => i !== idx)
    onCargar(nuevasImagenes)
  }

  return (
    <div className="space-y-3">
      <label className="mb-2 block font-serif-dm text-sm font-semibold text-tinta">
        {etiqueta} ({imagenes.length}/{maxImagenes})
      </label>

      {/* Grid de imágenes cargadas */}
      <div className="grid grid-cols-5 gap-2">
        {imagenes.map((img, idx) => (
          <div
            key={idx}
            className="group relative h-20 w-20 overflow-hidden border border-tinta bg-papel-calido"
          >
            <img
              src={img}
              alt={`Foto ${idx + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => eliminarImagen(idx)}
              className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-colors"
            >
              <MIcon name="close" className="text-white text-[20px]" />
            </button>
          </div>
        ))}

        {/* Botón para agregar imagen */}
        {imagenes.length < maxImagenes && (
          <button
            type="button"
            onClick={handleClick}
            disabled={cargando}
            className="h-20 w-20 border-2 border-dashed border-filete bg-papel-calido hover:enabled:border-tinta disabled:opacity-50 flex items-center justify-center"
          >
            <MIcon name="add_photo_alternate" className="text-[24px] text-pardo" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={TIPOS.join(',')}
        onChange={handleFileSelect}
        disabled={cargando || imagenes.length >= maxImagenes}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-terracota">{error}</p>
      )}

      {cargando && (
        <p className="text-sm text-pardo">Cargando imagen…</p>
      )}
    </div>
  )
}
