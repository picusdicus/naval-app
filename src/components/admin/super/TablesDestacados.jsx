import { useState, useEffect, useMemo } from 'react'
import MIcon from '../../MIcon.jsx'
import SelectorImagen from '../SelectorImagen.jsx'
import DialogoConfirmacion from '../DialogoConfirmacion.jsx'
import { COMERCIOS_POR_ID, diasParaCaducar, textoCaducidad } from '../../../lib/destacados.js'
import { useEventosPublicos } from '../../../lib/useEventosPublicos.js'
import { proximosEventos, formatearFechaCorta } from '../../../lib/eventos.js'
import { duracionDe, hoyISO, sumarDias } from '../../../lib/fechas.js'
import { PRESETS_DURACION } from '../../../lib/tarifasDestacados.js'

// Gestión de los destacados contratados: qué eventos y comercios se realzan
// en portada, agenda y guía, con qué orden y durante qué periodo. El pago se
// acuerda fuera de la app; aquí el superadmin lo refleja.

const ETIQUETA_ESTADO = {
  activo: { texto: 'Activo', clases: 'bg-verde text-papel hover:opacity-80' },
  pendiente: { texto: 'Pendiente', clases: 'bg-oro text-tinta hover:opacity-80' },
  cancelado: { texto: 'Cancelado', clases: 'bg-terracota-fondo text-terracota hover:opacity-80' },
}

// La duración se elige con los presets compartidos (tarifasDestacados.js) y
// fecha_fin se calcula al enviar (inclusiva: fin = inicio + N − 1).
// Función y no constante: con hoyISO() a nivel de módulo la fecha quedaría
// congelada en sesiones largas.
const crearFormularioVacio = () => ({
  tipo: 'evento',
  referenciaId: '',
  organizacionId: '',
  orden: 0,
  imagenUrl: '',
  fechaInicio: hoyISO(),
  duracionDias: '30',
})

export default function TablesDestacados() {
  const [destacados, setDestacados] = useState([])
  const [organizaciones, setOrganizaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [formularioData, setFormularioData] = useState(crearFormularioVacio)
  const [busquedaItem, setBusquedaItem] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [eliminando, setEliminando] = useState(null) // destacado pendiente de confirmar
  const [borrando, setBorrando] = useState(false)

  // Para resolver referencias y para el buscador del formulario.
  const { eventos } = useEventosPublicos()
  const eventosPorId = useMemo(() => new Map(eventos.map((e) => [e.id, e])), [eventos])

  useEffect(() => {
    cargarDestacados()
    fetch('/api/super/organizaciones')
      .then((r) => r.json())
      .then((datos) => setOrganizaciones(datos.organizaciones || []))
      .catch(() => setOrganizaciones([]))
  }, [])

  const cargarDestacados = async () => {
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/api/super/destacados')
      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'Error al cargar')
      setDestacados(datos.destacados || [])
    } catch (err) {
      setError(err.message)
      setDestacados([])
    } finally {
      setCargando(false)
    }
  }

  /** Nombre visible del item referenciado, o null si la referencia está muerta. */
  const nombreDeReferencia = (destacado) => {
    if (destacado.tipo === 'comercio') return COMERCIOS_POR_ID.get(destacado.referenciaId)?.nombre ?? null
    return eventosPorId.get(destacado.referenciaId)?.titulo ?? null
  }

  // Candidatos del buscador del formulario: eventos próximos o directorio
  // completo, filtrados por el texto tecleado.
  const candidatos = useMemo(() => {
    const texto = busquedaItem.trim().toLowerCase()
    if (texto.length < 2) return []
    const lista =
      formularioData.tipo === 'comercio'
        ? [...COMERCIOS_POR_ID.values()].map((c) => ({ id: c.id, nombre: c.nombre, detalle: c.tipoDisplay || c.subtipo || '' }))
        : proximosEventos(eventos).map((e) => ({ id: e.id, nombre: e.titulo, detalle: `${formatearFechaCorta(e.fecha)} · ${e.lugar || ''}` }))
    return lista.filter((i) => i.nombre.toLowerCase().includes(texto)).slice(0, 8)
  }, [busquedaItem, formularioData.tipo, eventos])

  const itemElegido = formularioData.referenciaId
    ? nombreDeReferencia({ tipo: formularioData.tipo, referenciaId: formularioData.referenciaId })
    : null

  const manejarEnvio = async (e) => {
    e.preventDefault()
    if (!formularioData.referenciaId) {
      setError('Elige el evento o comercio a destacar.')
      return
    }
    if (formularioData.tipo === 'comercio' && !formularioData.imagenUrl) {
      setError('Un comercio destacado necesita una imagen.')
      return
    }
    if (!formularioData.duracionDias) {
      setError('Indica la duración del destacado.')
      return
    }

    setEnviando(true)
    setError('')

    try {
      const metodo = editandoId ? 'PUT' : 'POST'
      const url = editandoId ? `/api/super/destacados?id=${editandoId}` : '/api/super/destacados'

      // fecha_fin se materializa aquí a partir de la duración elegida.
      const inicio = formularioData.fechaInicio || hoyISO()
      const res = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: formularioData.tipo,
          referenciaId: formularioData.referenciaId,
          organizacionId: formularioData.organizacionId || null,
          orden: Number(formularioData.orden) || 0,
          fechaInicio: inicio,
          fechaFin: sumarDias(inicio, Number(formularioData.duracionDias) - 1),
          imagenUrl: formularioData.imagenUrl || null,
        }),
      })

      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'Error al guardar')

      await cargarDestacados()
      cancelar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const patchEstado = async (destacado, estado) => {
    try {
      const res = await fetch(`/api/super/destacados?id=${destacado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      const datos = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(datos.error || 'Error al cambiar estado')
      await cargarDestacados()
    } catch (err) {
      setError(err.message)
    }
  }

  // pendiente → activo (aprobar) · activo ⇄ cancelado. Rechazar una solicitud
  // pendiente tiene su propio botón: no debe pasar por activo. Activar exige
  // duración: sin fecha_fin (solicitudes de las orgs, que nacen sin fechas, o
  // filas antiguas) se abre la edición para fijarla; aprobar es el segundo clic.
  const cambiarEstado = (destacado) => {
    if (destacado.estado !== 'activo' && !destacado.fechaFin) {
      abrirEdicion(destacado)
      return
    }
    patchEstado(destacado, destacado.estado === 'activo' ? 'cancelado' : 'activo')
  }

  const rechazar = (destacado) => patchEstado(destacado, 'cancelado')

  const eliminar = async () => {
    if (!eliminando) return
    setBorrando(true)
    try {
      const res = await fetch(`/api/super/destacados?id=${eliminando.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      await cargarDestacados()
      setEliminando(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBorrando(false)
    }
  }

  const abrirEdicion = (destacado) => {
    const fechaInicio = destacado.fechaInicio || hoyISO()
    setFormularioData({
      tipo: destacado.tipo,
      referenciaId: destacado.referenciaId,
      organizacionId: destacado.organizacionId || '',
      orden: destacado.orden,
      imagenUrl: destacado.imagenUrl || '',
      fechaInicio,
      // Se infiere la duración de las fechas actuales; sin fecha_fin (legacy o
      // solicitud recién llegada) queda vacía y el envío obliga a elegir.
      duracionDias: destacado.fechaFin ? String(duracionDe(fechaInicio, destacado.fechaFin)) : '',
    })
    setEditandoId(destacado.id)
    setBusquedaItem('')
    setMostrarFormulario(true)
  }

  const cancelar = () => {
    setMostrarFormulario(false)
    setEditandoId(null)
    setFormularioData(crearFormularioVacio())
    setBusquedaItem('')
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
            Nuevo destacado
          </button>

          <div className="overflow-x-auto border border-tinta">
            <table className="w-full font-serif-spectral text-sm text-tinta">
              <thead className="bg-papel-calido">
                <tr className="border-b border-filete">
                  <th className="px-4 py-3 text-left font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Tipo</th>
                  <th className="px-4 py-3 text-left font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Item</th>
                  <th className="px-4 py-3 text-left font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Contratante</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Orden</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Vigencia</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Estado</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {destacados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center font-serif-spectral text-pardo">
                      No hay destacados. Crea el primero con «Nuevo destacado».
                    </td>
                  </tr>
                ) : (
                  destacados.map((d) => {
                    const nombre = nombreDeReferencia(d)
                    const estado = ETIQUETA_ESTADO[d.estado] || ETIQUETA_ESTADO.cancelado
                    return (
                      <tr key={d.id} className="border-b border-filete hover:bg-papel-calido/60">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <MIcon name={d.tipo === 'evento' ? 'event' : 'storefront'} className="text-[18px] text-terracota" />
                            {d.tipo === 'evento' ? 'Evento' : 'Comercio'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <span className="inline-flex items-center gap-2">
                            {d.imagenUrl && (
                              <img src={d.imagenUrl} alt="" className="h-8 w-12 rounded object-cover" />
                            )}
                            {nombre ?? (
                              <span className="inline-flex items-center gap-1 text-terracota" title={d.referenciaId}>
                                <MIcon name="link_off" className="text-[16px]" />
                                Referencia no encontrada
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-pardo">{d.organizacionNombre || '—'}</td>
                        <td className="px-4 py-3 text-center">{d.orden}</td>
                        <td className="px-4 py-3 text-center text-pardo">
                          {d.fechaInicio}
                          {' → '}
                          {d.fechaFin || 'sin fin'}
                          {/* Las fechas de un pendiente son la propuesta de la org, no vigencia decidida. */}
                          {d.estado === 'pendiente' && d.fechaFin && (
                            <span className="ml-1.5 bg-oro px-1.5 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-tinta">
                              propuesta
                            </span>
                          )}
                          {!d.vigente && d.estado === 'activo' && (
                            <span className="ml-1.5 bg-terracota-fondo px-1.5 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-terracota">
                              fuera de plazo
                            </span>
                          )}
                          {/* Excluyente con "fuera de plazo": el aviso exige vigente. */}
                          {diasParaCaducar(d) !== null && (
                            <span className="ml-1.5 bg-tinta px-1.5 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-oro">
                              {textoCaducidad(diasParaCaducar(d))}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => cambiarEstado(d)}
                              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${estado.clases}`}
                              title={d.estado === 'pendiente' ? 'Aprobar y activar' : 'Cambiar estado'}
                            >
                              {estado.texto}
                            </button>
                            {d.estado === 'pendiente' && (
                              <button
                                onClick={() => rechazar(d)}
                                className="bg-terracota-fondo px-3 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota transition-opacity hover:opacity-80"
                                title="Rechazar la solicitud"
                              >
                                Rechazar
                              </button>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-2">
                            <button
                              onClick={() => abrirEdicion(d)}
                              className="text-tinta transition-colors hover:text-terracota"
                              title="Editar"
                            >
                              <MIcon name="edit" className="text-[20px]" />
                            </button>
                            <button
                              onClick={() => setEliminando(d)}
                              className="text-terracota transition-opacity hover:opacity-80"
                              title="Eliminar"
                            >
                              <MIcon name="delete" className="text-[20px]" />
                            </button>
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="max-w-2xl">
          <h2 className="mb-4 font-serif-dm text-2xl text-tinta">
            {editandoId ? 'Editar destacado' : 'Nuevo destacado'}
          </h2>

          <form onSubmit={manejarEnvio} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Tipo</label>
                <select
                  value={formularioData.tipo}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, tipo: e.target.value, referenciaId: '' })
                  }
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando || Boolean(editandoId)}
                >
                  <option value="evento">Evento</option>
                  <option value="comercio">Comercio</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Organización contratante</label>
                <select
                  value={formularioData.organizacionId}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, organizacionId: e.target.value })
                  }
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando}
                >
                  <option value="">— Sin asignar —</option>
                  {organizaciones.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Buscador del item a destacar (bloqueado al editar: la referencia
                es inmutable; para cambiar de item, eliminar y crear). */}
            <div>
              <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                {formularioData.tipo === 'evento' ? 'Evento a destacar' : 'Comercio a destacar'}
              </label>
              {formularioData.referenciaId ? (
                <div className="flex items-center justify-between border border-filete bg-papel-calido px-4 py-2">
                  <span className="text-sm font-medium">
                    {itemElegido ?? (
                      <span className="text-terracota" title={formularioData.referenciaId}>
                        Referencia no encontrada
                      </span>
                    )}
                  </span>
                  {!editandoId && (
                    <button
                      type="button"
                      onClick={() => setFormularioData({ ...formularioData, referenciaId: '' })}
                      className="text-mudo hover:text-terracota"
                      title="Quitar"
                    >
                      <MIcon name="close" className="text-[18px]" />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={busquedaItem}
                    onChange={(e) => setBusquedaItem(e.target.value)}
                    placeholder={
                      formularioData.tipo === 'evento'
                        ? 'Escribe para buscar entre los próximos eventos y elige uno…'
                        : 'Escribe para buscar en el directorio y elige uno…'
                    }
                    className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                    disabled={enviando}
                  />
                  {candidatos.length > 0 && (
                    <ul className="mt-1 divide-y divide-filete overflow-hidden border border-filete">
                      {candidatos.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setFormularioData({ ...formularioData, referenciaId: c.id })
                              setBusquedaItem('')
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Orden</label>
                <input
                  type="number"
                  min="0"
                  value={formularioData.orden}
                  onChange={(e) => setFormularioData({ ...formularioData, orden: e.target.value })}
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando}
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Inicio</label>
                <input
                  type="date"
                  value={formularioData.fechaInicio}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, fechaInicio: e.target.value })
                  }
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando}
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Duración</label>
                <select
                  value={formularioData.duracionDias}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, duracionDias: e.target.value })
                  }
                  className="w-full border border-filete bg-papel px-3.5 py-2.5 font-serif-spectral text-sm text-tinta focus:border-tinta focus:outline-none"
                  disabled={enviando}
                >
                  {formularioData.duracionDias === '' && (
                    <option value="" disabled>
                      Selecciona duración…
                    </option>
                  )}
                  {/* Campañas con duración no estándar: se puede reguardar sin alterarla. */}
                  {formularioData.duracionDias !== '' &&
                    !PRESETS_DURACION.includes(Number(formularioData.duracionDias)) && (
                      <option value={formularioData.duracionDias}>
                        Personalizada ({formularioData.duracionDias} días)
                      </option>
                    )}
                  {PRESETS_DURACION.map((n) => (
                    <option key={n} value={String(n)}>
                      {n} días
                    </option>
                  ))}
                </select>
                <p className="mt-1 font-mono-ibm text-[10px] text-mudo">
                  Fin:{' '}
                  {formularioData.duracionDias
                    ? sumarDias(
                        formularioData.fechaInicio || hoyISO(),
                        Number(formularioData.duracionDias) - 1,
                      )
                    : '—'}
                </p>
              </div>
            </div>

            <SelectorImagen
              valor={formularioData.imagenUrl}
              onChange={(url) => setFormularioData({ ...formularioData, imagenUrl: url })}
              etiqueta="Imagen del destacado"
              opcional={formularioData.tipo === 'evento'}
            />

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={enviando || !formularioData.referenciaId}
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

      <DialogoConfirmacion
        abierto={Boolean(eliminando)}
        titulo="Eliminar destacado"
        mensaje={`Se dejará de destacar «${eliminando ? nombreDeReferencia(eliminando) ?? eliminando.referenciaId : ''}». Esta acción no se puede deshacer.`}
        ocupado={borrando}
        onConfirmar={eliminar}
        onCancelar={() => setEliminando(null)}
      />
    </div>
  )
}
