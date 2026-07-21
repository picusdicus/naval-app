import { useState } from 'react'
import { LISTA_CATEGORIAS } from '../../lib/categorias.js'
import { COCINA_LABEL } from '../../lib/cocinas.js'
import MIcon from '../MIcon.jsx'

const ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT || ''
const EMAIL_DESTINO = 'directorio@navalcarnero.example'

// Tipos de cocina para el desplegable, ordenados por su etiqueta en español.
const OPCIONES_COCINA = Object.entries(COCINA_LABEL)
  .map(([valor, etiqueta]) => ({ valor, etiqueta }))
  .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))

export default function SugerirComercio({ onCerrar }) {
  const [datos, setDatos] = useState({
    nombre: '',
    categoria: 'alimentacion',
    cocina: '',
    direccion: '',
    telefono: '',
    notas: '',
  })
  const [estado, setEstado] = useState('idle') // idle | enviando | ok | error

  function actualizar(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  async function enviar(e) {
    e.preventDefault()
    if (!datos.nombre.trim()) return
    setEstado('enviando')

    // Con backend/servicio de formularios configurado: POST. Si no, mailto.
    if (ENDPOINT) {
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(datos),
        })
        setEstado(res.ok ? 'ok' : 'error')
      } catch {
        setEstado('error')
      }
    } else {
      const cuerpo = [
        `Nombre: ${datos.nombre}`,
        `Categoría: ${datos.categoria}`,
        datos.categoria === 'restauracion' ? `Tipo de cocina: ${datos.cocina}` : null,
        `Dirección: ${datos.direccion}`,
        `Teléfono: ${datos.telefono}`,
        `Notas: ${datos.notas}`,
      ]
        .filter(Boolean)
        .join('\n')
      window.location.href = `mailto:${EMAIL_DESTINO}?subject=${encodeURIComponent(
        'Sugerencia de comercio: ' + datos.nombre,
      )}&body=${encodeURIComponent(cuerpo)}`
      setEstado('ok')
    }
  }

  if (estado === 'ok') {
    return (
      <div className="gz-tarjeta-impresa p-5 text-center">
        <p className="font-serif-dm text-lg text-tinta">¡Gracias por tu aportación!</p>
        <p className="mt-1 font-serif-spectral text-sm text-pardo">
          Revisaremos el comercio y lo añadiremos al directorio.
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="gz-boton-tinta mt-4"
        >
          Cerrar
        </button>
      </div>
    )
  }

  return (
    <div className="gz-tarjeta-impresa p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif-dm text-xl text-tinta">Sugerir un comercio</h3>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar formulario"
          className="p-1 text-pardo transition-colors hover:text-terracota"
        >
          <MIcon name="close" className="text-[20px]" />
        </button>
      </div>

      <form onSubmit={enviar} className="space-y-3">
        <div>
          <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Nombre *</label>
          <input
            type="text"
            required
            value={datos.nombre}
            onChange={(e) => actualizar('nombre', e.target.value)}
            className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Categoría</label>
          <select
            value={datos.categoria}
            onChange={(e) => actualizar('categoria', e.target.value)}
            className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
          >
            {LISTA_CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        {datos.categoria === 'restauracion' && (
          <div>
            <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Tipo de cocina</label>
            <select
              value={datos.cocina}
              onChange={(e) => actualizar('cocina', e.target.value)}
              className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
            >
              <option value="">Sin especificar</option>
              {OPCIONES_COCINA.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.etiqueta}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Dirección</label>
          <input
            type="text"
            value={datos.direccion}
            onChange={(e) => actualizar('direccion', e.target.value)}
            className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Teléfono</label>
          <input
            type="tel"
            value={datos.telefono}
            onChange={(e) => actualizar('telefono', e.target.value)}
            className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Notas</label>
          <textarea
            rows={2}
            value={datos.notas}
            onChange={(e) => actualizar('notas', e.target.value)}
            className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
          />
        </div>

        {estado === 'error' && (
          <p className="font-serif-spectral text-xs text-terracota">No se pudo enviar. Inténtalo de nuevo.</p>
        )}

        <button
          type="submit"
          disabled={estado === 'enviando'}
          className="gz-boton-tinta w-full disabled:opacity-60"
        >
          {estado === 'enviando' ? 'Enviando…' : 'Enviar sugerencia'}
        </button>
      </form>
    </div>
  )
}
