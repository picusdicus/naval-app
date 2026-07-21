import { useState } from 'react'
import { LISTA_CATEGORIAS } from '../lib/categorias.js'
import MIcon from '../components/MIcon.jsx'
import SelectorImagen from '../components/admin/SelectorImagen.jsx'

const ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT || ''
const EMAIL_DESTINO = 'sugerencias@navalcarnero.example'

const TIPOS_SUGERENCIA = [
  { id: 'idea', label: 'Idea' },
  { id: 'evento', label: 'Evento' },
  { id: 'comercio', label: 'Comercio' },
  { id: 'error', label: 'Error' },
]

export default function Sugerencias() {
  const [tipo, setTipo] = useState('idea')
  const [datos, setDatos] = useState({
    titulo: '',
    detalle: '',
    email: '',
    foto: null,
  })
  const [datosComercio, setDatosComercio] = useState({
    nombre: '',
    direccion: '',
    tipo: 'alimentacion',
    telefono: '',
    horarios: '',
    foto: null,
  })
  const [estado, setEstado] = useState('idle')

  function actualizar(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  function actualizarComercio(campo, valor) {
    setDatosComercio((prev) => ({ ...prev, [campo]: valor }))
  }

  async function enviar(e) {
    e.preventDefault()

    if (tipo === 'comercio') {
      if (!datosComercio.nombre.trim()) return
      setEstado('enviando')

      const payload = {
        tipo: 'comercio',
        nombre: datosComercio.nombre,
        direccion: datosComercio.direccion,
        tipoNegocio: datosComercio.tipo,
        horarios: datosComercio.horarios,
        telefono: datosComercio.telefono,
        foto: datosComercio.foto,
      }

      if (ENDPOINT) {
        try {
          const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          setEstado(res.ok ? 'ok' : 'error')
        } catch {
          setEstado('error')
        }
      } else {
        const cuerpo = [
          `Tipo: Comercio`,
          `Nombre: ${datosComercio.nombre}`,
          `Tipo de negocio: ${datosComercio.tipo}`,
          `Dirección: ${datosComercio.direccion}`,
          `Teléfono: ${datosComercio.telefono}`,
          `Horarios: ${datosComercio.horarios}`,
        ]
          .filter(Boolean)
          .join('\n')
        window.location.href = `mailto:${EMAIL_DESTINO}?subject=${encodeURIComponent(
          'Alta de comercio: ' + datosComercio.nombre,
        )}&body=${encodeURIComponent(cuerpo)}`
        setEstado('ok')
      }
    } else {
      if (!datos.titulo.trim()) return
      setEstado('enviando')

      const payload = {
        tipo,
        ...datos,
      }

      if (ENDPOINT) {
        try {
          const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          setEstado(res.ok ? 'ok' : 'error')
        } catch {
          setEstado('error')
        }
      } else {
        const tipoLabel = TIPOS_SUGERENCIA.find((t) => t.id === tipo)?.label || tipo
        const cuerpo = [
          `Tipo: ${tipoLabel}`,
          `Título: ${datos.titulo}`,
          `Detalles: ${datos.detalle}`,
          datos.email ? `Email: ${datos.email}` : null,
        ]
          .filter(Boolean)
          .join('\n')
        window.location.href = `mailto:${EMAIL_DESTINO}?subject=${encodeURIComponent(
          `${tipoLabel}: ${datos.titulo}`,
        )}&body=${encodeURIComponent(cuerpo)}`
        setEstado('ok')
      }
    }
  }

  function reiniciar() {
    setEstado('idle')
    setTipo('idea')
    setDatos({ titulo: '', detalle: '', email: '', foto: null })
    setDatosComercio({ nombre: '', direccion: '', tipo: 'alimentacion', telefono: '', horarios: '', foto: null })
  }

  if (estado === 'ok') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="gz-tarjeta-impresa p-8 text-center">
          <MIcon name="check_circle" className="mx-auto text-[48px] text-terracota" />
          <p className="mt-4 font-serif-dm text-2xl text-tinta">¡Gracias por tu aportación!</p>
          <p className="mt-2 font-serif-spectral text-sm text-pardo">
            {tipo === 'comercio'
              ? 'Revisaremos el comercio y lo añadiremos al directorio.'
              : 'Tu sugerencia nos ayuda a mejorar. La revisaremos pronto.'}
          </p>
          <button type="button" onClick={reiniciar} className="gz-boton-tinta mt-6">
            Enviar otra sugerencia
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="gz-filete-doble mb-6 pb-4">
        <div className="gz-label text-mudo">Para cuidar del pueblo</div>
        <h1 className="font-serif-dm text-seccion leading-none text-tinta">Una sugerencia</h1>
      </header>

      <p className="mb-6 font-serif-spectral text-sm text-pardo">
        ¿Echas algo en falta? ¿Un evento, un comercio, una mejora? Cuéntanoslo — lee el equipo del pueblo.
      </p>

      <form onSubmit={enviar} className="space-y-6">
        {/* Selector de tipo de sugerencia */}
        <div>
          <label className="mb-2 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
            Tipo de sugerencia *
          </label>
          <div className="flex flex-wrap gap-2">
            {TIPOS_SUGERENCIA.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTipo(t.id)
                  setEstado('idle')
                }}
                className={`px-4 py-2 transition-colors ${
                  tipo === t.id
                    ? 'bg-tinta text-papel'
                    : 'border border-tinta text-tinta hover:bg-papel-calido'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tipo === 'comercio' ? (
          // Formulario de Alta de Comercio
          <>
            <div>
              <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Nombre del comercio *
              </label>
              <input
                type="text"
                required
                value={datosComercio.nombre}
                onChange={(e) => actualizarComercio('nombre', e.target.value)}
                className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
                placeholder="P. ej. Panadería La Espiga"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Tipo de negocio *
              </label>
              <select
                required
                value={datosComercio.tipo}
                onChange={(e) => actualizarComercio('tipo', e.target.value)}
                className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
              >
                {LISTA_CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Dirección *
              </label>
              <input
                type="text"
                required
                value={datosComercio.direccion}
                onChange={(e) => actualizarComercio('direccion', e.target.value)}
                className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
                placeholder="Calle, número, Navalcarnero"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Horarios *
              </label>
              <input
                type="text"
                required
                value={datosComercio.horarios}
                onChange={(e) => actualizarComercio('horarios', e.target.value)}
                className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
                placeholder="L-V 09:00 - 14:00 · 17:00 - 20:30"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Teléfono
              </label>
              <input
                type="tel"
                value={datosComercio.telefono}
                onChange={(e) => actualizarComercio('telefono', e.target.value)}
                className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
              />
            </div>

            <div>
              <SelectorImagen
                etiqueta="Foto del comercio"
                opcional={true}
                valor={datosComercio.foto}
                onChange={(img) => actualizarComercio('foto', img)}
              />
            </div>
          </>
        ) : (
          // Formulario genérico de sugerencias
          <>
            <div>
              <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Título *
              </label>
              <input
                type="text"
                required
                value={datos.titulo}
                onChange={(e) => actualizar('titulo', e.target.value)}
                className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
                placeholder="Resume tu idea en una frase"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Cuéntanos más *
              </label>
              <textarea
                required
                rows={4}
                value={datos.detalle}
                onChange={(e) => actualizar('detalle', e.target.value)}
                className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
                placeholder="Explica con detalle qué propones y por qué…"
              />
              <p className="mt-1 text-right font-mono-ibm text-[9px] text-mudo">
                {datos.detalle.length} / 500
              </p>
            </div>

            <div>
              <label className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Tu email (opcional, para responderte)
              </label>
              <input
                type="email"
                value={datos.email}
                onChange={(e) => actualizar('email', e.target.value)}
                className="w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta"
                placeholder="tucorreo@ejemplo.com"
              />
            </div>
          </>
        )}

        {estado === 'error' && (
          <p className="rounded border border-terracota bg-terracota/10 px-4 py-3 font-serif-spectral text-sm text-terracota">
            No se pudo enviar. Inténtalo de nuevo o copia el texto y envíanoslo por correo.
          </p>
        )}

        <button
          type="submit"
          disabled={estado === 'enviando'}
          className="gz-boton-tinta w-full disabled:opacity-60"
        >
          {estado === 'enviando' ? 'Enviando…' : 'Enviar sugerencia'}
        </button>
      </form>

      <p className="mt-8 text-center font-serif-spectral text-xs text-mudo">
        Gracias por cuidar del pueblo.
      </p>
    </div>
  )
}
