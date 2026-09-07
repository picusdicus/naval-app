import { useState } from 'react'
import { LIMITES } from '../../../lib/tallerForm.js'
import MIcon from '../../MIcon.jsx'

// Importación del catálogo de talleres desde el folleto municipal en PDF.
// Dos vías, porque el folleto llega de las dos maneras: como fichero que le
// pasan al superadmin y como enlace publicado en navalcarnero.es.
//
// Todo lo importado nace BORRADOR y hay que revisarlo antes de publicar: se
// avisa aquí para que nadie espere ver el catálogo en la web al terminar.

const MAX_MB = 3

export default function DialogoImportarTalleres({ cursoSugerido = '', onImportado, onCerrar }) {
  const [via, setVia] = useState('archivo') // 'archivo' | 'url'
  const [fichero, setFichero] = useState(null)
  const [url, setUrl] = useState('')
  const [curso, setCurso] = useState(cursoSugerido)
  const [importando, setImportando] = useState(false)
  const [fallo, setFallo] = useState('')
  const [resultado, setResultado] = useState(null)

  const leerBase64 = (f) =>
    new Promise((resolve, reject) => {
      const lector = new FileReader()
      lector.onload = () => resolve(String(lector.result))
      lector.onerror = () => reject(new Error('No se pudo leer el fichero.'))
      lector.readAsDataURL(f)
    })

  const enviar = async (e) => {
    e.preventDefault()
    setFallo('')

    if (!curso.trim()) return setFallo('Indica a qué curso pertenece el folleto.')
    if (via === 'archivo' && !fichero) return setFallo('Elige el PDF del folleto.')
    if (via === 'url' && !url.trim()) return setFallo('Pega el enlace del PDF.')
    // Se comprueba aquí además de en el servidor para no gastar la subida.
    if (via === 'archivo' && fichero.size > MAX_MB * 1024 * 1024) {
      return setFallo(
        `El PDF ocupa ${(fichero.size / 1024 / 1024).toFixed(1)} MB y el máximo por subida es ${MAX_MB} MB. Si está en navalcarnero.es, impórtalo por enlace.`,
      )
    }

    setImportando(true)
    try {
      const cuerpo = { curso: curso.trim() }
      if (via === 'archivo') {
        cuerpo.pdfBase64 = await leerBase64(fichero)
        cuerpo.nombreFichero = fichero.name
      } else {
        cuerpo.url = url.trim()
      }

      const res = await fetch('/api/super/talleres-importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      const datos = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(datos.error || 'No se pudo importar el folleto.')
      setResultado(datos)
      onImportado(datos)
    } catch (err) {
      setFallo(err.message)
    } finally {
      setImportando(false)
    }
  }

  if (resultado) {
    return (
      <div className="flex flex-col gap-4 border border-tinta bg-papel p-4">
        <h3 className="font-serif-dm text-lg text-tinta">Folleto importado</h3>
        <p className="font-serif-spectral text-sm text-tinta">
          Se han creado <strong>{resultado.creados}</strong>{' '}
          {resultado.creados === 1 ? 'taller' : 'talleres'} del curso {resultado.curso}, todos en{' '}
          <strong>borrador</strong>: revísalos y publícalos uno a uno.
        </p>
        {resultado.cursoDetectado && resultado.cursoDetectado !== resultado.curso && (
          <p className="flex items-start gap-2 border border-oro bg-papel-calido p-2.5 font-serif-spectral text-sm text-tinta">
            <MIcon name="warning" className="mt-0.5 text-[16px] text-oro" />
            En el folleto pone «{resultado.cursoDetectado}» y has elegido «{resultado.curso}».
            Se ha guardado el que elegiste.
          </p>
        )}
        {resultado.descartados?.length > 0 && (
          <div className="border border-terracota bg-terracota-fondo p-2.5">
            <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota">
              {resultado.descartados.length} sin importar
            </p>
            <ul className="mt-1 font-serif-spectral text-xs text-tinta">
              {resultado.descartados.map((d, i) => (
                <li key={i}>
                  {d.nombre} — {d.motivo}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end border-t border-filete pt-4">
          <button type="button" onClick={onCerrar} className="gz-boton-tinta">
            Ver los talleres importados
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 border border-tinta bg-papel p-4">
      <div>
        <h3 className="font-serif-dm text-lg text-tinta">Importar folleto de horarios</h3>
        <p className="mt-1 font-serif-spectral text-sm text-pardo">
          Los talleres extraídos se guardan en <strong>borrador</strong>: nada se publica solo.
        </p>
      </div>

      {fallo && (
        <p className="flex items-center gap-2 border border-terracota bg-terracota-fondo p-2.5 font-serif-spectral text-sm text-terracota">
          <MIcon name="error" className="text-[16px]" />
          {fallo}
        </p>
      )}

      <div>
        <span className="gz-label mb-1.5 block text-pardo">Curso</span>
        <input
          type="text"
          value={curso}
          onChange={(e) => setCurso(e.target.value)}
          placeholder="2026/2027"
          maxLength={LIMITES.curso}
          className="gz-input w-full"
        />
        <p className="mt-1 font-serif-spectral text-xs text-mudo">
          Es lo que decide cuándo se archiva el catálogo, así que manda esto y no lo que ponga el PDF.
        </p>
      </div>

      <div className="flex gap-2">
        {[
          ['archivo', 'Subir un PDF'],
          ['url', 'Desde un enlace'],
        ].map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setVia(valor)}
            aria-pressed={via === valor}
            className={`flex-1 border px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta transition-colors ${
              via === valor
                ? 'border-tinta bg-tinta text-papel'
                : 'border-filete bg-papel text-pardo hover:border-tinta'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {via === 'archivo' ? (
        <div>
          <label htmlFor="imp-archivo" className="gz-label mb-1.5 block text-pardo">
            Folleto en PDF
          </label>
          <input
            id="imp-archivo"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFichero(e.target.files?.[0] || null)}
            className="w-full font-serif-spectral text-sm text-tinta file:mr-3 file:border file:border-tinta file:bg-papel file:px-3 file:py-1.5 file:font-mono-ibm file:text-[10px] file:uppercase file:tracking-etiqueta file:text-tinta"
          />
          <p className="mt-1 font-serif-spectral text-xs text-mudo">Máximo {MAX_MB} MB.</p>
        </div>
      ) : (
        <div>
          <label htmlFor="imp-url" className="gz-label mb-1.5 block text-pardo">
            Enlace al PDF
          </label>
          <input
            id="imp-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://navalcarnero.es/wp-content/uploads/…"
            className="gz-input w-full"
          />
          <p className="mt-1 font-serif-spectral text-xs text-mudo">
            Solo enlaces de navalcarnero.es.
          </p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-filete pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCerrar} disabled={importando} className="gz-boton-borde">
          Cancelar
        </button>
        <button type="submit" disabled={importando} className="gz-boton-tinta">
          <MIcon
            name={importando ? 'progress_activity' : 'upload_file'}
            className="mr-1 text-[16px]"
          />
          {importando ? 'Leyendo el folleto…' : 'Importar'}
        </button>
      </div>
      {importando && (
        <p className="font-serif-spectral text-xs text-mudo">
          Puede tardar unos segundos: el documento entero se manda a analizar.
        </p>
      )}
    </form>
  )
}
