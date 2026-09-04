import { useState } from 'react'
import { createPortal } from 'react-dom'
import { LISTA_CATEGORIAS } from '../../lib/categorias.js'
import { COCINA_LABEL } from '../../lib/cocinas.js'
import { useRecaptcha } from '../../lib/useRecaptcha.js'
import MIcon from '../MIcon.jsx'

// Alta de comercio con revisión y aprobación del superadmin (issue #35): la
// solicitud queda en solicitudes_alta_comercio y aparece en /admin → Altas.
// A diferencia de Sugerencias.jsx (ideas/eventos/errores, sin backend propio
// aún), este formulario tiene un endpoint real dedicado — no usar el genérico
// /api/sugerencias, que solo hace console.log y no persiste nada.
const ENDPOINT = '/api/solicitar-alta-comercio'

// Tipos de cocina para el desplegable, ordenados por su etiqueta en español.
const OPCIONES_COCINA = Object.entries(COCINA_LABEL)
  .map(([valor, etiqueta]) => ({ valor, etiqueta }))
  .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))

export default function SugerirComercio({ onCerrar }) {
  const { getToken } = useRecaptcha()
  const [datos, setDatos] = useState({
    nombre: '',
    categoria: 'alimentacion',
    cocina: '',
    direccion: '',
    telefono: '',
    notas: '',
  })
  const [estado, setEstado] = useState('idle') // idle | enviando | ok | error
  const [mensajeError, setMensajeError] = useState('')

  function actualizar(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  async function enviar(e) {
    e.preventDefault()
    if (!datos.nombre.trim()) return
    setEstado('enviando')
    setMensajeError('')

    try {
      const token = await getToken('sugerir_comercio')
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          nombre: datos.nombre,
          categoria: datos.categoria,
          direccion: datos.direccion,
          telefono: datos.telefono,
          notas: datos.notas,
          recaptchaToken: token,
        }),
      })
      const cuerpo = await res.json().catch(() => ({}))

      if (res.ok) {
        setEstado('ok')
      } else {
        // 409: nombre parecido a uno ya existente (ver solicitar-alta-comercio.js) —
        // el mensaje del servidor ya explica qué hacer, se muestra tal cual.
        setMensajeError(cuerpo.error || 'No se pudo enviar. Inténtalo de nuevo.')
        setEstado('error')
      }
    } catch {
      setMensajeError('No se pudo enviar. Inténtalo de nuevo.')
      setEstado('error')
    }
  }

  // Portal a <body>: montado como un botón más del listado de comercios, que
  // en un listado largo puede quedar fuera de la vista — un overlay fijo sin
  // portal se recortaría igual si algún ancestro llevara transform (ver nota
  // "animate-rise atrapa fixed"). Con portal siempre centra en viewport, sin
  // depender de scroll.
  if (estado === 'ok') {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="gz-tarjeta-impresa w-full max-w-md p-5 text-center">
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
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="gz-tarjeta-impresa max-h-[90vh] w-full max-w-md overflow-y-auto p-4">
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
            <p className="font-serif-spectral text-xs text-terracota">{mensajeError}</p>
          )}

          <button
            type="submit"
            disabled={estado === 'enviando'}
            className="gz-boton-tinta w-full disabled:opacity-60"
          >
            {estado === 'enviando' ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  )
}
