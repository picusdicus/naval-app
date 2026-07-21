import { useState, useEffect } from 'react'
import MIcon from '../../MIcon.jsx'

export default function TablesCodigosInvitacion() {
  const [codigos, setCodigos] = useState([])
  const [organizaciones, setOrganizaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [formularioData, setFormularioData] = useState({
    organizacionId: '',
    rolConcedido: 'editor',
    usosMaximos: 1,
    expiracion: '',
  })
  const [enviando, setEnviando] = useState(false)
  const [filtroOrg, setFiltroOrg] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    setError('')
    try {
      const [resCodeigos, resOrgs] = await Promise.all([
        fetch('/api/super/codigos'),
        fetch('/api/super/organizaciones'),
      ])

      const datosCodeigos = await resCodeigos.json()
      const datosOrgs = await resOrgs.json()

      if (!resCodeigos.ok) throw new Error(datosCodeigos.error || 'Error al cargar códigos')
      if (!resOrgs.ok) throw new Error(datosOrgs.error || 'Error al cargar organizaciones')

      setCodigos(datosCodeigos.codigos || [])
      setOrganizaciones(datosOrgs.organizaciones || [])
    } catch (err) {
      setError(err.message)
      setCodigos([])
    } finally {
      setCargando(false)
    }
  }

  const manejarEnvio = async (e) => {
    e.preventDefault()
    if (!formularioData.organizacionId || !formularioData.rolConcedido || !formularioData.usosMaximos) {
      setError('Completa todos los campos requeridos.')
      return
    }

    setEnviando(true)
    setError('')

    try {
      const res = await fetch('/api/super/codigos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formularioData,
          usosMaximos: parseInt(formularioData.usosMaximos),
        }),
      })

      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'Error al crear')

      await cargarDatos()
      setMostrarFormulario(false)
      setFormularioData({
        organizacionId: '',
        rolConcedido: 'editor',
        usosMaximos: 1,
        expiracion: '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const cancelar = () => {
    setMostrarFormulario(false)
    setFormularioData({
      organizacionId: '',
      rolConcedido: 'editor',
      usosMaximos: 1,
      expiracion: '',
    })
    setError('')
  }

  const copioCodigo = (codigo) => {
    navigator.clipboard.writeText(codigo)
  }

  const obtenerNombreOrg = (id) => {
    return organizaciones.find((o) => o.id === id)?.nombre || 'Desconocida'
  }

  const codigosFiltrados = filtroOrg ? codigos.filter((c) => c.organizacionId === filtroOrg) : codigos

  const obtenerColorEstado = (estado) => {
    switch (estado) {
      case 'activo':
        return 'bg-verde text-papel'
      case 'agotado':
        return 'bg-warning/20 text-warning'
      case 'caducado':
        return 'bg-terracota-fondo text-terracota'
      default:
        return 'bg-filete text-tinta-apagada'
    }
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
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setMostrarFormulario(true)}
              className="flex items-center gap-2 bg-tinta px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel hover:opacity-90 active:scale-[0.98]"
            >
              <MIcon name="add" className="text-[20px]" />
              Nuevo código
            </button>
            <select
              value={filtroOrg}
              onChange={(e) => setFiltroOrg(e.target.value)}
              className="border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
            >
              <option value="">Todas las organizaciones</option>
              {organizaciones.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto border border-tinta">
            <table className="w-full font-serif-spectral text-sm text-tinta">
              <thead className="bg-papel-calido">
                <tr className="border-b border-filete">
                  <th className="px-4 py-3 text-left font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Código</th>
                  <th className="px-4 py-3 text-left font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Organización</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Rol</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Usos</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Expira</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Estado</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Acción</th>
                </tr>
              </thead>
              <tbody>
                {codigosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center font-serif-spectral text-pardo">
                      No hay códigos de invitación
                    </td>
                  </tr>
                ) : (
                  codigosFiltrados.map((codigo) => (
                    <tr key={codigo.id} className="border-b border-filete hover:bg-papel-calido/60">
                      <td className="px-4 py-3 font-mono-ibm font-medium text-verde">{codigo.codigo}</td>
                      <td className="px-4 py-3 text-tinta-apagada">
                        {obtenerNombreOrg(codigo.organizacionId)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block bg-papel-calido px-2 py-1 font-mono-ibm text-[10px] text-pardo">
                          {codigo.rolConcedido}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {codigo.usosActuales}/{codigo.usosMaximos}
                      </td>
                      <td className="px-4 py-3 text-center text-pardo">
                        {codigo.expiracion ? new Date(codigo.expiracion).toLocaleDateString('es-ES') : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${obtenerColorEstado(codigo.estado)}`}>
                          {codigo.estado.charAt(0).toUpperCase() + codigo.estado.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => copioCodigo(codigo.codigo)}
                          className="text-terracota transition-opacity hover:opacity-80"
                          title="Copiar código"
                        >
                          <MIcon name="content_copy" className="text-[20px]" />
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
          <h2 className="mb-4 font-serif-dm text-2xl text-tinta">Generar nuevo código de invitación</h2>

          <form onSubmit={manejarEnvio} className="space-y-4">
            <div>
              <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Organización *</label>
              <select
                value={formularioData.organizacionId}
                onChange={(e) =>
                  setFormularioData({ ...formularioData, organizacionId: e.target.value })
                }
                className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                disabled={enviando}
              >
                <option value="">Selecciona una organización</option>
                {organizaciones
                  .filter((o) => o.activa)
                  .map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Rol *</label>
                <select
                  value={formularioData.rolConcedido}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, rolConcedido: e.target.value })
                  }
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando}
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Usos máximos *</label>
                <input
                  type="number"
                  min="1"
                  value={formularioData.usosMaximos}
                  onChange={(e) =>
                    setFormularioData({
                      ...formularioData,
                      usosMaximos: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando}
                />
              </div>

              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Fecha de caducidad</label>
                <input
                  type="date"
                  value={formularioData.expiracion}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, expiracion: e.target.value })
                  }
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={enviando || !formularioData.organizacionId}
                className="bg-tinta px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {enviando ? 'Generando…' : 'Generar código'}
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
