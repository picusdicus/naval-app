import { useState, useEffect, useMemo } from 'react'
import MIcon from '../../MIcon.jsx'
import { COMERCIOS_POR_ID } from '../../../lib/destacados.js'
import { LISTA_CATEGORIAS_EVENTO } from '../../../lib/eventos.js'

const FORMULARIO_VACIO = {
  nombre: '',
  slug: '',
  descripcion: '',
  emailContacto: '',
  telefono: '',
  web: '',
  comercioId: '',
  // Perfil de eventos: el formulario de /panel los muestra como solo lectura
  // y el servidor machaca con ellos lo que mande el cliente. Sin rellenarlos,
  // la organización no puede publicar eventos.
  categoriaDefecto: '',
  lugarDefecto: '',
}

export default function TablesOrganizaciones() {
  const [organizaciones, setOrganizaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [formularioData, setFormularioData] = useState(FORMULARIO_VACIO)
  const [busquedaComercio, setBusquedaComercio] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [enviando, setEnviando] = useState(false)

  // Candidatos del buscador de "Negocio vinculado" (mismo patrón que el
  // formulario de destacados): filtra el directorio por el texto tecleado.
  const candidatosComercio = useMemo(() => {
    const texto = busquedaComercio.trim().toLowerCase()
    if (texto.length < 2) return []
    return [...COMERCIOS_POR_ID.values()]
      .filter((c) => c.nombre.toLowerCase().includes(texto))
      .slice(0, 8)
      .map((c) => ({ id: c.id, nombre: c.nombre, detalle: c.tipoDisplay || c.subtipo || '' }))
  }, [busquedaComercio])

  useEffect(() => {
    cargarOrganizaciones()
  }, [])

  const cargarOrganizaciones = async () => {
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/api/super/organizaciones')
      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'Error al cargar')
      setOrganizaciones(datos.organizaciones || [])
    } catch (err) {
      setError(err.message)
      setOrganizaciones([])
    } finally {
      setCargando(false)
    }
  }

  const manejarEnvio = async (e) => {
    e.preventDefault()
    if (!formularioData.nombre || !formularioData.slug) {
      setError('Nombre y slug son requeridos.')
      return
    }

    setEnviando(true)
    setError('')

    try {
      const metodo = editandoId ? 'PUT' : 'POST'
      const url = editandoId ? `/api/super/organizaciones?id=${editandoId}` : '/api/super/organizaciones'

      const res = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formularioData),
      })

      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'Error al guardar')

      await cargarOrganizaciones()
      setMostrarFormulario(false)
      setEditandoId(null)
      setFormularioData(FORMULARIO_VACIO)
      setBusquedaComercio('')
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      const res = await fetch(`/api/super/organizaciones?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: nuevoEstado }),
      })
      if (!res.ok) throw new Error('Error al cambiar estado')
      await cargarOrganizaciones()
    } catch (err) {
      setError(err.message)
    }
  }

  const abrirEdicion = (org) => {
    setFormularioData({
      nombre: org.nombre,
      slug: org.slug,
      descripcion: org.descripcion || '',
      emailContacto: org.emailContacto || '',
      telefono: org.telefono || '',
      web: org.web || '',
      comercioId: org.comercioId || '',
      categoriaDefecto: org.categoriaDefecto || '',
      lugarDefecto: org.lugarDefecto || '',
    })
    setEditandoId(org.id)
    setBusquedaComercio('')
    setMostrarFormulario(true)
  }

  const cancelar = () => {
    setMostrarFormulario(false)
    setEditandoId(null)
    setFormularioData(FORMULARIO_VACIO)
    setBusquedaComercio('')
    setError('')
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-filete border-t-terracota" />
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-start gap-2 border border-terracota/30 bg-terracota-fondo p-3">
          <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-terracota" />
          <p className="font-serif-spectral text-sm font-medium text-terracota">{error}</p>
        </div>
      )}

      {!mostrarFormulario ? (
        <>
          <button
            onClick={() => setMostrarFormulario(true)}
            className="mb-4 flex items-center gap-2 bg-tinta px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel hover:opacity-90 active:scale-[0.98]"
          >
            <MIcon name="add" className="text-[20px]" />
            Nueva organización
          </button>

          <div className="overflow-x-auto border border-tinta">
            <table className="w-full font-serif-spectral text-sm text-tinta">
              <thead className="bg-papel-calido">
                <tr className="border-b border-filete">
                  <th className="px-4 py-3 text-left font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Nombre</th>
                  <th className="px-4 py-3 text-left font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Slug</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Usuarios</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Eventos</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Códigos</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Estado</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {organizaciones.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center font-serif-spectral text-pardo">
                      No hay organizaciones registradas
                    </td>
                  </tr>
                ) : (
                  organizaciones.map((org) => (
                    <tr key={org.id} className="border-b border-filete hover:bg-papel-calido/60">
                      <td className="px-4 py-3 font-medium">
                        {org.nombre}
                        {org.comercioId && (
                          <span className="mt-0.5 flex items-center gap-1 font-mono-ibm text-[10px] normal-case tracking-normal text-mudo">
                            <MIcon name="storefront" className="text-[14px]" />
                            {COMERCIOS_POR_ID.get(org.comercioId)?.nombre || org.comercioId}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-pardo">{org.slug}</td>
                      <td className="px-4 py-3 text-center">{org.usuariosCount}</td>
                      <td className="px-4 py-3 text-center">{org.eventosCount}</td>
                      <td className="px-4 py-3 text-center">{org.codigosActivosCount}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => cambiarEstado(org.id, !org.activa)}
                          className={`px-3 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta transition-opacity ${
                            org.activa
                              ? 'bg-verde text-papel hover:opacity-80'
                              : 'bg-terracota-fondo text-terracota hover:opacity-80'
                          }`}
                        >
                          {org.activa ? 'Activa' : 'Inactiva'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => abrirEdicion(org)}
                          className="text-terracota transition-opacity hover:opacity-80"
                        >
                          <MIcon name="edit" className="text-[20px]" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="max-w-2xl">
          <h2 className="mb-4 font-serif-dm text-2xl text-tinta">
            {editandoId ? 'Editar organización' : 'Nueva organización'}
          </h2>

          <form onSubmit={manejarEnvio} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Nombre</label>
                <input
                  type="text"
                  value={formularioData.nombre}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, nombre: e.target.value })
                  }
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando}
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Slug</label>
                <input
                  type="text"
                  value={formularioData.slug}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, slug: e.target.value })
                  }
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Descripción</label>
              <textarea
                value={formularioData.descripcion}
                onChange={(e) =>
                  setFormularioData({ ...formularioData, descripcion: e.target.value })
                }
                className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                rows="3"
                disabled={enviando}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Email de contacto</label>
                <input
                  type="email"
                  value={formularioData.emailContacto}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, emailContacto: e.target.value })
                  }
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando}
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Teléfono</label>
                <input
                  type="tel"
                  value={formularioData.telefono}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, telefono: e.target.value })
                  }
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando}
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Sitio web</label>
                <input
                  type="url"
                  value={formularioData.web}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, web: e.target.value })
                  }
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando}
                />
              </div>
            </div>

            {/* Perfil de eventos: cada evento de la organización se publica
                con esta categoría y este lugar (el gestor los ve como solo
                lectura en su formulario). Sin ambos, no puede publicar. */}
            <div>
              <p className="mb-2 text-sm font-semibold">
                Perfil de eventos
                <span className="ml-1.5 normal-case tracking-normal text-mudo">
                  (sin categoría y lugar, la organización no puede publicar eventos)
                </span>
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Categoría por defecto</label>
                  <select
                    value={formularioData.categoriaDefecto}
                    onChange={(e) =>
                      setFormularioData({ ...formularioData, categoriaDefecto: e.target.value })
                    }
                    className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                    disabled={enviando}
                  >
                    <option value="">— Sin asignar —</option>
                    {LISTA_CATEGORIAS_EVENTO.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Lugar por defecto</label>
                  <input
                    type="text"
                    value={formularioData.lugarDefecto}
                    onChange={(e) =>
                      setFormularioData({ ...formularioData, lugarDefecto: e.target.value })
                    }
                    placeholder="P. ej. Teatro Centro, Navalcarnero"
                    className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                    disabled={enviando}
                  />
                </div>
              </div>
            </div>

            {/* Vincula la cuenta con su ficha del directorio: habilita que la
                organización solicite destacar su negocio desde /panel. */}
            <div>
              <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Negocio vinculado
                <span className="ml-1.5 normal-case tracking-normal text-mudo">(opcional)</span>
              </label>
              {formularioData.comercioId ? (
                <div className="flex items-center justify-between border border-filete bg-papel-calido px-4 py-2">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <MIcon name="storefront" className="text-[18px] text-terracota" />
                    {COMERCIOS_POR_ID.get(formularioData.comercioId)?.nombre || (
                      <span className="text-terracota" title={formularioData.comercioId}>
                        Referencia no encontrada
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormularioData({ ...formularioData, comercioId: '' })}
                    className="text-mudo hover:text-terracota"
                    title="Desvincular"
                    disabled={enviando}
                  >
                    <MIcon name="close" className="text-[18px]" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={busquedaComercio}
                    onChange={(e) => setBusquedaComercio(e.target.value)}
                    placeholder="Escribe para buscar en el directorio y elige uno…"
                    className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                    disabled={enviando}
                  />
                  {candidatosComercio.length > 0 && (
                    <ul className="mt-1 divide-y divide-filete overflow-hidden border border-filete">
                      {candidatosComercio.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setFormularioData({ ...formularioData, comercioId: c.id })
                              setBusquedaComercio('')
                            }}
                            className="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left font-serif-spectral text-sm hover:bg-papel-calido"
                          >
                            <span className="font-medium">{c.nombre}</span>
                            <span className="shrink-0 font-mono-ibm text-[10px] text-mudo">{c.detalle}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={enviando || !formularioData.nombre || !formularioData.slug}
                className="bg-tinta px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {enviando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={cancelar}
                disabled={enviando}
                className="border border-tinta px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta hover:bg-papel-calido"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
