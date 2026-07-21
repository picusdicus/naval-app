import { useRef, useState } from 'react'
import MIcon from '../MIcon.jsx'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 3 * 1024 * 1024

/** Lee el fichero como base64 (sin el prefijo `data:...;base64,`). */
function aBase64(fichero) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result).split(',')[1])
    lector.onerror = () => reject(new Error('No se pudo leer el fichero.'))
    lector.readAsDataURL(fichero)
  })
}

/**
 * Sube el cartel del evento a Vercel Blob y comunica la URL resultante al
 * formulario. La imagen viaja en base64 dentro del JSON (ver api/admin/imagen.js).
 */
export default function SelectorImagen({
  valor,
  onChange,
  error,
  etiqueta = 'Cartel del evento',
  opcional = true,
}) {
  const entrada = useRef(null)
  const [subiendo, setSubiendo] = useState(false)
  const [fallo, setFallo] = useState('')

  const elegir = async (evento) => {
    const fichero = evento.target.files?.[0]
    // Permite volver a elegir el mismo fichero tras un error.
    evento.target.value = ''
    if (!fichero) return

    setFallo('')

    if (!TIPOS.includes(fichero.type)) {
      setFallo('Formato no admitido. Usa JPG, PNG o WebP.')
      return
    }
    if (fichero.size > MAX_BYTES) {
      setFallo('La imagen supera los 3 MB.')
      return
    }

    setSubiendo(true)
    try {
      const datos = await aBase64(fichero)
      const respuesta = await fetch('/api/admin/imagen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: fichero.name, tipo: fichero.type, datos }),
      })
      const cuerpo = await respuesta.json().catch(() => ({}))
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo subir la imagen.')
      onChange(cuerpo.url)
    } catch (err) {
      setFallo(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  const mensaje = fallo || error

  return (
    <div>
      <span className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
        {etiqueta}
        {opcional && <span className="ml-1.5 normal-case tracking-normal text-mudo">(opcional)</span>}
      </span>

      {valor ? (
        <div className="relative overflow-hidden border border-tinta">
          <img src={valor} alt="Cartel del evento" className="max-h-56 w-full object-contain" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-2 inline-flex items-center gap-1 bg-papel/95 px-3 py-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota"
          >
            <MIcon name="delete" className="text-[15px]" />
            Quitar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={subiendo}
          className="flex w-full flex-col items-center gap-2 border border-dashed border-filete-punteado px-4 py-8 font-serif-spectral text-mudo transition-colors hover:enabled:border-tinta hover:enabled:text-tinta disabled:opacity-60"
        >
          <MIcon name={subiendo ? 'progress_activity' : 'add_photo_alternate'} className="text-[28px]" />
          <span className="text-sm">{subiendo ? 'Subiendo…' : 'Subir una imagen'}</span>
          <span className="font-mono-ibm text-[9px] uppercase tracking-etiqueta">
            JPG · PNG · WebP — máx 3 MB
          </span>
        </button>
      )}

      <input
        ref={entrada}
        type="file"
        accept={TIPOS.join(',')}
        onChange={elegir}
        className="hidden"
      />

      {mensaje && (
        <p className="mt-1.5 flex items-center gap-1 font-serif-spectral text-xs font-medium text-terracota">
          <MIcon name="error" className="text-[14px]" />
          {mensaje}
        </p>
      )}
    </div>
  )
}
