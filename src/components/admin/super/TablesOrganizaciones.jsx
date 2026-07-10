import { useState, useEffect } from 'react'
import MIcon from '../../MIcon.jsx'

export default function TablesOrganizaciones() {
  const [organizaciones, setOrganizaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [formularioData, setFormularioData] = useState({
    nombre: '',
    slug: '',
    descripcion: '',
    emailContacto: '',
    telefono: '',
    web: '',
  })
  const [editandoId, setEditandoId] = useState(null)
  const [enviando, setEnviando] = useState(false)

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
      setFormularioData({
        nombre: '',
        slug: '',
        descripcion: '',
        emailContacto: '',
        telefono: '',
        web: '',
      })
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
    })
    setEditandoId(org.id)
    setMostrarFormulario(true)
  }

  const cancelar = () => {
    setMostrarFormulario(false)
    setEditandoId(null)
    setFormularioData({
      nombre: '',
      slug: '',
      descripcion: '',
      emailContacto: '',
      telefono: '',
      web: '',
    })
    setError('')
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 p-3">
          <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-error" />
          <p className="text-sm font-medium text-error">{error}</p>
        </div>
      )}

      {!mostrarFormulario ? (
        <>
          <button
            onClick={() => setMostrarFormulario(true)}
            className="mb-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:shadow-card-lg active:scale-[0.98]"
          >
            <MIcon name="add" className="text-[20px]" />
            Nueva organización
          </button>

          <div className="overflow-x-auto rounded-lg border border-outline-variant/30">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-high">
                <tr className="border-b border-outline-variant/30">
                  <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold">Slug</th>
                  <th className="px-4 py-3 text-center font-semibold">Usuarios</th>
                  <th className="px-4 py-3 text-center font-semibold">Eventos</th>
                  <th className="px-4 py-3 text-center font-semibold">Códigos</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {organizaciones.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-on-surface/50">
                      No hay organizaciones registradas
                    </td>
                  </tr>
                ) : (
                  organizaciones.map((org) => (
                    <tr key={org.id} className="border-b border-outline-variant/30 hover:bg-surface-container-high/50">
                      <td className="px-4 py-3 font-medium">{org.nombre}</td>
                      <td className="px-4 py-3 text-on-surface/70">{org.slug}</td>
                      <td className="px-4 py-3 text-center">{org.usuariosCount}</td>
                      <td className="px-4 py-3 text-center">{org.eventosCount}</td>
                      <td className="px-4 py-3 text-center">{org.codigosActivosCount}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => cambiarEstado(org.id, !org.activa)}
                          className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                            org.activa
                              ? 'bg-success/20 text-success hover:bg-success/30'
                              : 'bg-error/20 text-error hover:bg-error/30'
                          }`}
                        >
                          {org.activa ? 'Activa' : 'Inactiva'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => abrirEdicion(org)}
                          className="text-primary hover:text-primary/80 transition-colors"
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
          <h2 className="mb-4 text-xl font-bold text-on-surface">
            {editandoId ? 'Editar organización' : 'Nueva organización'}
          </h2>

          <form onSubmit={manejarEnvio} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">Nombre</label>
                <input
                  type="text"
                  value={formularioData.nombre}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, nombre: e.target.value })
                  }
                  className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
                  disabled={enviando}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold">Slug</label>
                <input
                  type="text"
                  value={formularioData.slug}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, slug: e.target.value })
                  }
                  className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
                  disabled={enviando}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Descripción</label>
              <textarea
                value={formularioData.descripcion}
                onChange={(e) =>
                  setFormularioData({ ...formularioData, descripcion: e.target.value })
                }
                className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
                rows="3"
                disabled={enviando}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold">Email de contacto</label>
                <input
                  type="email"
                  value={formularioData.emailContacto}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, emailContacto: e.target.value })
                  }
                  className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
                  disabled={enviando}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold">Teléfono</label>
                <input
                  type="tel"
                  value={formularioData.telefono}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, telefono: e.target.value })
                  }
                  className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
                  disabled={enviando}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold">Sitio web</label>
                <input
                  type="url"
                  value={formularioData.web}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, web: e.target.value })
                  }
                  className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
                  disabled={enviando}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={enviando || !formularioData.nombre || !formularioData.slug}
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:shadow-card-lg active:scale-[0.98] disabled:opacity-50"
              >
                {enviando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={cancelar}
                disabled={enviando}
                className="rounded-lg border border-outline-variant px-4 py-2 font-semibold hover:bg-surface-container-high"
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
