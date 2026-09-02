import { useEffect, useRef, useState } from 'react'
import MIcon from '../../MIcon.jsx'
import { optimizarImagen } from '../../../lib/imageOptimizer.js'

/**
 * Subida de una imagen genérica de evento a una categoría/subtipo dados.
 * Lo usan el panel "Imágenes genéricas" (categoría/subtipo elegidos en su
 * navegación) y el detalle de cada evento del tab Eventos (categoría/subtipo
 * del propio evento, ya resueltos). El fichero se queda en memoria con vista
 * previa local y se optimiza (WebP, 1200px) y sube UNA vez, con los metadatos,
 * al pulsar Guardar → POST /api/admin/imagen-evento-generica.
 *
 * Props:
 *  - categoria (obligatoria), disciplina (null = generales de la categoría)
 *  - onSubida(fila): la fila devuelta por la API
 *  - compacto: metadatos en una sola fila (para el detalle del evento)
 *  - etiquetaSoloEste: si se pasa, muestra la casilla que marca la imagen como
 *    `soloAsignacion` (fuera del reparto automático, solo para los eventos a
 *    los que se asigne a mano). El texto describe el efecto en ese contexto.
 */
export default function FormularioImagenGenerica({
  categoria,
  disciplina = null,
  onSubida,
  compacto = false,
  etiquetaSoloEste = '',
}) {
  const entrada = useRef(null)
  const [fichero, setFichero] = useState(null)
  const [previa, setPrevia] = useState('')
  const [autor, setAutor] = useState('')
  const [fuente, setFuente] = useState('')
  const [licencia, setLicencia] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [soloEste, setSoloEste] = useState(false)

  useEffect(() => {
    if (!fichero) {
      setPrevia('')
      return undefined
    }
    const url = URL.createObjectURL(fichero)
    setPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [fichero])

  const guardar = async () => {
    if (!fichero) return
    setError('')
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
          categoria,
          disciplina: disciplina || null,
          autor: autor.trim() || null,
          fuente: fuente.trim() || null,
          licencia: licencia.trim() || null,
          descripcion: descripcion.trim() || null,
          soloAsignacion: soloEste,
        }),
      })
      const cuerpo = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(cuerpo.error || 'No se pudo subir la imagen.')
      setFichero(null)
      setAutor('')
      setFuente('')
      setLicencia('')
      setDescripcion('')
      setSoloEste(false)
      onSubida?.(cuerpo)
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const campo = (valor, setValor, placeholder) => (
    <input
      type="text"
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-tinta px-2 py-1 text-sm"
    />
  )

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
          Imagen
        </span>
        {fichero ? (
          <div className="relative overflow-hidden border border-tinta">
            <img src={previa} alt="" className={`${compacto ? 'max-h-40' : 'max-h-56'} w-full object-contain`} />
            <button
              type="button"
              onClick={() => setFichero(null)}
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
            className={`flex w-full flex-col items-center gap-2 border border-dashed border-filete-punteado px-4 ${compacto ? 'py-5' : 'py-8'} font-serif-spectral text-mudo transition-colors hover:border-tinta hover:text-tinta`}
          >
            <MIcon name="add_photo_alternate" className="text-[28px]" />
            <span className="text-sm">Elegir una imagen</span>
            <span className="font-mono-ibm text-[9px] uppercase tracking-etiqueta">
              JPG · PNG · WebP — se optimiza al guardar
            </span>
          </button>
        )}
        <input
          ref={entrada}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] || null
            e.target.value = ''
            if (f) setFichero(f)
          }}
        />
      </div>

      {compacto ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {campo(autor, setAutor, 'Autor')}
          {campo(fuente, setFuente, 'Fuente (Pexels, Unsplash…)')}
          {campo(licencia, setLicencia, 'Licencia (CC BY, CC0…)')}
        </div>
      ) : (
        <>
          <div>
            <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Autor</label>
            {campo(autor, setAutor, 'Nombre del autor')}
          </div>
          <div>
            <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
              Fuente (Pexels, Unsplash, etc.)
            </label>
            {campo(fuente, setFuente, 'Fuente de la imagen')}
          </div>
          <div>
            <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Licencia</label>
            {campo(licencia, setLicencia, 'CC BY, CC0, etc.')}
          </div>
          <div>
            <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción breve (ej: pista y raqueta)"
              rows="2"
              className="w-full resize-none border border-tinta px-2 py-1 text-sm"
            />
          </div>
        </>
      )}

      {etiquetaSoloEste && (
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={soloEste}
            onChange={(e) => setSoloEste(e.target.checked)}
            className="mt-1 h-3.5 w-3.5 shrink-0"
          />
          <span className="font-serif-spectral text-sm text-tinta">{etiquetaSoloEste}</span>
        </label>
      )}

      {error && (
        <p className="flex items-center gap-1 font-serif-spectral text-xs font-medium text-terracota">
          <MIcon name="error" className="text-[14px]" />
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={ocupado || !fichero}
        className="w-full bg-terracota px-3 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel transition-colors hover:bg-tinta disabled:opacity-50"
      >
        {ocupado ? 'Subiendo…' : 'Guardar imagen'}
      </button>
    </div>
  )
}
