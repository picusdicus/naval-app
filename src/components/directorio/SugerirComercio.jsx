import { useState } from 'react'
import { LISTA_CATEGORIAS } from '../../lib/categorias.js'
import { COCINA_LABEL } from '../../lib/cocinas.js'
import { IconClose } from '../icons.jsx'

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
      <div className="rounded-2xl border border-tierra/10 bg-white p-5 text-center">
        <p className="font-medium text-vino">¡Gracias por tu aportación!</p>
        <p className="mt-1 text-sm text-tinta-muted">
          Revisaremos el comercio y lo añadiremos al directorio.
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="mt-4 rounded-full bg-vino px-4 py-2 text-sm font-medium text-crema"
        >
          Cerrar
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-tierra/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-vino">Sugerir un comercio</h3>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar formulario"
          className="rounded-full p-1 text-tinta-muted hover:bg-crema-dark"
        >
          <IconClose className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={enviar} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-tinta">Nombre *</label>
          <input
            type="text"
            required
            value={datos.nombre}
            onChange={(e) => actualizar('nombre', e.target.value)}
            className="w-full rounded-lg border border-tierra/20 bg-white px-3 py-2 text-sm outline-none focus:border-tierra"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-tinta">Categoría</label>
          <select
            value={datos.categoria}
            onChange={(e) => actualizar('categoria', e.target.value)}
            className="w-full rounded-lg border border-tierra/20 bg-white px-3 py-2 text-sm outline-none focus:border-tierra"
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
            <label className="mb-1 block text-xs font-medium text-tinta">Tipo de cocina</label>
            <select
              value={datos.cocina}
              onChange={(e) => actualizar('cocina', e.target.value)}
              className="w-full rounded-lg border border-tierra/20 bg-white px-3 py-2 text-sm outline-none focus:border-tierra"
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
          <label className="mb-1 block text-xs font-medium text-tinta">Dirección</label>
          <input
            type="text"
            value={datos.direccion}
            onChange={(e) => actualizar('direccion', e.target.value)}
            className="w-full rounded-lg border border-tierra/20 bg-white px-3 py-2 text-sm outline-none focus:border-tierra"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-tinta">Teléfono</label>
          <input
            type="tel"
            value={datos.telefono}
            onChange={(e) => actualizar('telefono', e.target.value)}
            className="w-full rounded-lg border border-tierra/20 bg-white px-3 py-2 text-sm outline-none focus:border-tierra"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-tinta">Notas</label>
          <textarea
            rows={2}
            value={datos.notas}
            onChange={(e) => actualizar('notas', e.target.value)}
            className="w-full rounded-lg border border-tierra/20 bg-white px-3 py-2 text-sm outline-none focus:border-tierra"
          />
        </div>

        {estado === 'error' && (
          <p className="text-xs text-red-700">No se pudo enviar. Inténtalo de nuevo.</p>
        )}

        <button
          type="submit"
          disabled={estado === 'enviando'}
          className="w-full rounded-full bg-vino px-4 py-2 text-sm font-medium text-crema disabled:opacity-60"
        >
          {estado === 'enviando' ? 'Enviando…' : 'Enviar sugerencia'}
        </button>
      </form>
    </div>
  )
}
