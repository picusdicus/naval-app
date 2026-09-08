import { useState, useEffect, useMemo } from 'react'
import MIcon from '../../MIcon.jsx'
import SelectorImagen from '../SelectorImagen.jsx'
import DialogoConfirmacion from '../DialogoConfirmacion.jsx'
import {
  COMERCIOS_POR_ID,
  campanaFinalizada,
  diasParaCaducar,
  porcentajeTranscurrido,
  textoCaducidad,
} from '../../../lib/destacados.js'
import { useEventosPublicos } from '../../../lib/useEventosPublicos.js'
import { proximosEventos, formatearFechaCorta } from '../../../lib/eventos.js'
import { useTalleres } from '../../../lib/useTalleres.js'
import { nombreCategoriaTaller, textoTurno } from '../../../lib/talleres.js'
import { diasHasta, duracionDe, hoyISO, sumarDias } from '../../../lib/fechas.js'
import { PRESETS_DURACION } from '../../../lib/tarifasDestacados.js'

// Gestión de los destacados contratados: qué eventos y comercios se realzan
// en portada, agenda y guía, con qué orden y durante qué periodo. El pago se
// acuerda fuera de la app; aquí el superadmin lo refleja.

// Los tres tipos destacables. Un tipo desconocido (fila de una versión futura)
// degrada a "Comercio" en la tabla en vez de romper el render.
const ETIQUETA_TIPO = { evento: 'Evento', comercio: 'Comercio', taller: 'Taller' }
const ICONO_TIPO = { evento: 'event', comercio: 'storefront', taller: 'school' }

// Pastilla de estado sobre la superficie oscura. Mismos tonos que la de
// Organizaciones y Códigos: verde-noche para lo que está en marcha, oro para
// lo que espera una decisión y terracota para lo que ya no sirve.
const ETIQUETA_ESTADO = {
  activo: { texto: 'Activo', clases: 'bg-verde-noche text-tinta' },
  pendiente: { texto: 'Pendiente', clases: 'bg-oro text-tinta' },
  cancelado: { texto: 'Cancelado', clases: 'bg-terracota text-papel' },
}

// Clases compartidas con los formularios de Organizaciones y Códigos. Se
// copian por tercera vez en vez de extraerse: son tres cadenas, y el fichero
// común que las unificara habría que leerlo para saber qué pinta cada campo.
const CLASES_CAMPO =
  'w-full border border-nocturno-outline bg-nocturno-sidebar px-3.5 py-2.5 font-serif-spectral text-sm text-nocturno-texto focus:border-terracota focus:outline-none'
const CLASES_ETIQUETA =
  'mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-secundario'
const CLASES_BOTON_SECUNDARIO =
  'border border-nocturno-outline px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-nocturno-texto hover:bg-nocturno-sidebar'

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
  // Los talleres se destacan como eventos y comercios, así que esta tabla
  // también tiene que saber resolver su nombre: sin esto un taller destacado
  // se listaba como "Comercio · Referencia no encontrada".
  const { talleres } = useTalleres()
  const talleresPorId = useMemo(() => new Map(talleres.map((t) => [t.id, t])), [talleres])

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
    if (destacado.tipo === 'taller') return talleresPorId.get(destacado.referenciaId)?.nombre ?? null
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
        : formularioData.tipo === 'taller'
          ? talleres.map((t) => ({
              id: t.id,
              nombre: t.nombre,
              // Un taller no tiene fecha: lo que distingue dos parecidos es su
              // disciplina y su primer turno.
              detalle: `${nombreCategoriaTaller(t.categoria)} · ${t.turnos?.[0] ? textoTurno(t.turnos[0]) : 'sin horario'}`,
            }))
          : proximosEventos(eventos).map((e) => ({ id: e.id, nombre: e.titulo, detalle: `${formatearFechaCorta(e.fecha)} · ${e.lugar || ''}` }))
    return lista.filter((i) => i.nombre.toLowerCase().includes(texto)).slice(0, 8)
  }, [busquedaItem, formularioData.tipo, eventos, talleres])

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
        {/* La pista del giro va en un tono de la paleta oscura: con el filete
            claro, el arco terracota dejaba de distinguirse del anillo. */}
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-nocturno-outline border-t-terracota-legible" />
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-start gap-2 border border-terracota/30 bg-terracota/10 p-3">
          <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-terracota-legible" />
          <p className="font-serif-spectral text-sm font-medium text-terracota-legible">{error}</p>
        </div>
      )}

      {!mostrarFormulario ? (
        <>
          <button
            onClick={() => setMostrarFormulario(true)}
            className="mb-4 flex items-center gap-2 bg-terracota px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel hover:opacity-90 active:scale-[0.98]"
          >
            <MIcon name="add" className="text-[20px]" />
            Nuevo destacado
          </button>

          {destacados.length === 0 ? (
            <p className="py-8 text-center font-serif-spectral text-sm text-nocturno-secundario">
              No hay destacados. Crea el primero desde el botón de arriba.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {destacados.map((d) => (
                <TarjetaDestacado
                  key={d.id}
                  destacado={d}
                  nombre={nombreDeReferencia(d)}
                  onCambiarEstado={cambiarEstado}
                  onRechazar={rechazar}
                  onEditar={abrirEdicion}
                  onEliminar={setEliminando}
                />
              ))}

              {/* El alta cierra la rejilla como una celda más. El aria-label la
                  distingue del botón de la cabecera, que rotula igual: con
                  lector de pantalla se oían dos "Nuevo destacado" seguidos. */}
              <button
                type="button"
                aria-label="Añadir un destacado nuevo"
                onClick={() => setMostrarFormulario(true)}
                className="flex min-h-[9rem] items-center justify-center gap-2 rounded-2xl border border-dashed border-nocturno-outline p-5 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-nocturno-secundario transition-colors hover:border-terracota hover:text-terracota-legible"
              >
                <MIcon name="add" className="text-[20px]" />
                Nuevo destacado
              </button>
            </div>
          )}
        </>
      ) : (
        // colorScheme dark: los tres desplegables (Tipo, Organización y
        // Duración) y el selector de fecha los pinta el sistema, no las clases.
        <div className="max-w-2xl" style={{ colorScheme: 'dark' }}>
          <div className="rounded-2xl border border-nocturno-borde bg-nocturno-superficie p-6">
            <h2 className="mb-4 font-serif-dm text-2xl text-nocturno-texto">
              {editandoId ? 'Editar destacado' : 'Nuevo destacado'}
            </h2>

          <form onSubmit={manejarEnvio} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={CLASES_ETIQUETA}>Tipo</label>
                <select
                  value={formularioData.tipo}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, tipo: e.target.value, referenciaId: '' })
                  }
                  className={CLASES_CAMPO}
                  disabled={enviando || Boolean(editandoId)}
                >
                  <option value="evento">Evento</option>
                  <option value="taller">Taller</option>
                  <option value="comercio">Comercio</option>
                </select>
              </div>
              <div>
                <label className={CLASES_ETIQUETA}>Organización contratante</label>
                <select
                  value={formularioData.organizacionId}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, organizacionId: e.target.value })
                  }
                  className={CLASES_CAMPO}
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
              <label className={CLASES_ETIQUETA}>
                {`${ETIQUETA_TIPO[formularioData.tipo] || 'Comercio'} a destacar`}
              </label>
              {formularioData.referenciaId ? (
                <div className="flex items-center justify-between border border-nocturno-outline bg-nocturno-sidebar px-4 py-2">
                  <span className="font-serif-spectral text-sm font-medium text-nocturno-texto">
                    {itemElegido ?? (
                      <span className="text-terracota-legible" title={formularioData.referenciaId}>
                        Referencia no encontrada
                      </span>
                    )}
                  </span>
                  {!editandoId && (
                    <button
                      type="button"
                      onClick={() => setFormularioData({ ...formularioData, referenciaId: '' })}
                      className="text-nocturno-terciario hover:text-terracota-legible"
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
                      formularioData.tipo === 'taller'
                        ? 'Escribe para buscar entre los talleres publicados y elige uno…'
                        : formularioData.tipo === 'evento'
                        ? 'Escribe para buscar entre los próximos eventos y elige uno…'
                        : 'Escribe para buscar en el directorio y elige uno…'
                    }
                    className={CLASES_CAMPO}
                    disabled={enviando}
                  />
                  {candidatos.length > 0 && (
                    <ul className="mt-1 divide-y divide-nocturno-borde overflow-hidden border border-nocturno-outline bg-nocturno-superficie">
                      {candidatos.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setFormularioData({ ...formularioData, referenciaId: c.id })
                              setBusquedaItem('')
                            }}
                            className="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left font-serif-spectral text-sm text-nocturno-texto hover:bg-nocturno-sidebar"
                          >
                            <span className="font-medium">{c.nombre}</span>
                            <span className="shrink-0 font-mono-ibm text-[10px] text-nocturno-terciario">{c.detalle}</span>
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
                <label className={CLASES_ETIQUETA}>Orden</label>
                <input
                  type="number"
                  min="0"
                  value={formularioData.orden}
                  onChange={(e) => setFormularioData({ ...formularioData, orden: e.target.value })}
                  className={CLASES_CAMPO}
                  disabled={enviando}
                />
              </div>
              <div>
                <label className={CLASES_ETIQUETA}>Inicio</label>
                <input
                  type="date"
                  value={formularioData.fechaInicio}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, fechaInicio: e.target.value })
                  }
                  className={CLASES_CAMPO}
                  disabled={enviando}
                />
              </div>
              <div>
                <label className={CLASES_ETIQUETA}>Duración</label>
                <select
                  value={formularioData.duracionDias}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, duracionDias: e.target.value })
                  }
                  className={CLASES_CAMPO}
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
                <p className="mt-1 font-mono-ibm text-[10px] text-nocturno-terciario">
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

            {/* SelectorImagen se comparte con /panel, que se queda en claro:
                no se le puede tocar una clase. En vez de dejarlo como un trozo
                del formulario que se olvidó de oscurecer, se envuelve en una
                pieza clara delimitada, que se lee como deliberada. */}
            <div className="rounded-xl border border-nocturno-outline bg-papel p-4">
              <SelectorImagen
                valor={formularioData.imagenUrl}
                onChange={(url) => setFormularioData({ ...formularioData, imagenUrl: url })}
                etiqueta="Imagen del destacado"
                opcional={formularioData.tipo === 'evento'}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={enviando || !formularioData.referenciaId}
                className="bg-terracota px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {enviando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={cancelar}
                disabled={enviando}
                className={CLASES_BOTON_SECUNDARIO}
              >
                Cancelar
              </button>
            </div>
          </form>
          </div>
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

/**
 * Una campaña contratada. Homónimo del <TarjetaDestacado> público
 * (components/destacados/): aquel pinta el destacado para el vecino, este lo
 * pinta para quien lo gestiona. No se importan entre sí.
 *
 * Reparto del espacio, de arriba abajo: qué está destacado (miniatura y
 * nombre, que es lo que se busca al mirar), quién lo contrató, cuánto le
 * queda, y qué se puede hacer con él.
 */
function TarjetaDestacado({ destacado: d, nombre, onCambiarEstado, onRechazar, onEditar, onEliminar }) {
  const estado = ETIQUETA_ESTADO[d.estado] || ETIQUETA_ESTADO.cancelado
  const dias = diasParaCaducar(d)
  // Las fechas de un pendiente son la propuesta de la organización, no una
  // vigencia decidida: se pintan como texto, sin barra que sugiera que corre.
  const esPropuesta = d.estado === 'pendiente' && Boolean(d.fechaFin)
  const conPlazo = !esPropuesta && Boolean(d.fechaInicio && d.fechaFin)
  const porcentaje = conPlazo ? porcentajeTranscurrido(d.fechaInicio, d.fechaFin) : 0
  const restantes = conPlazo ? diasHasta(d.fechaFin) : null
  // campanaFinalizada es el criterio compartido con el Resumen, y para un
  // activo decide igual que aquí. El segundo término solo alcanza a lo que
  // ella deja fuera por exigir activo: un cancelado cuyo plazo ya pasó, que
  // sin esto llegaba a anunciar "Quedan −5 días".
  const finalizada = campanaFinalizada(d) || (conPlazo && restantes < 0)

  return (
    // min-w-0: sin él la celda se ensancha hasta caber el título de evento más
    // largo y desborda la rejilla en móvil.
    <div
      data-testid="tarjeta-destacado"
      className="flex min-w-0 flex-col rounded-2xl border border-nocturno-borde bg-nocturno-superficie p-5"
    >
      <div className="flex items-start gap-3">
        {d.imagenUrl ? (
          <img src={d.imagenUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        ) : (
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-nocturno-outline"
            aria-hidden="true"
          >
            <MIcon
              name={ICONO_TIPO[d.tipo] || 'storefront'}
              className="text-[20px] text-nocturno-texto"
            />
          </span>
        )}

        <div className="min-w-0 flex-1">
          {nombre ? (
            // Dos líneas y no truncado: con la pastilla ocupando su parte de
            // la cabecera, a una sola línea caben ~20 caracteres y casi todo
            // título de evento del programa se quedaba en "Cena Benéfica Ju…".
            <p className="line-clamp-2 font-serif-dm text-lg leading-tight text-nocturno-texto" title={nombre}>
              {nombre}
            </p>
          ) : (
            // El id crudo va en el title: identifica la fila muerta sin
            // ensanchar la tarjeta con un `gpl_…` de cuarenta caracteres.
            <p
              className="flex items-center gap-1 font-serif-spectral text-sm text-terracota-legible"
              title={d.referenciaId}
            >
              <MIcon name="link_off" className="shrink-0 text-[16px]" />
              <span className="truncate">Referencia no encontrada</span>
            </p>
          )}
          <p
            className="mt-0.5 truncate font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-secundario"
            title={`${ETIQUETA_TIPO[d.tipo] || 'Comercio'} · ${d.organizacionNombre || 'Sin contratante'}`}
          >
            <MIcon
              name={ICONO_TIPO[d.tipo] || 'storefront'}
              className="mr-1 align-[-3px] text-[14px]"
            />
            {ETIQUETA_TIPO[d.tipo] || 'Comercio'}
            {' · '}
            {d.organizacionNombre || 'Sin contratante'}
          </p>
        </div>

        {/* La pastilla ES la acción de estado, y "Rechazar" cuelga de ella en
            columna en vez de en fila: los dos caben así a la derecha de la
            miniatura sin estrujar el nombre en una tarjeta de un tercio. */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            onClick={() => onCambiarEstado(d)}
            className={`rounded-full px-3 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta transition-opacity hover:opacity-80 ${estado.clases}`}
            title={d.estado === 'pendiente' ? 'Aprobar y activar' : 'Cambiar estado'}
          >
            {estado.texto}
          </button>
          {d.estado === 'pendiente' && (
            <button
              onClick={() => onRechazar(d)}
              className="rounded-full border border-nocturno-outline px-3 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-secundario transition-colors hover:border-terracota hover:text-terracota-legible"
              title="Rechazar la solicitud"
            >
              Rechazar
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        {esPropuesta ? (
          <>
            <span className="rounded bg-oro px-2 py-0.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta">
              Propuesta
            </span>
            <p className="mt-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-terciario">
              {formatearFechaCorta(d.fechaInicio)} → {formatearFechaCorta(d.fechaFin)}
            </p>
          </>
        ) : conPlazo ? (
          <>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-nocturno-outline"
              role="img"
              aria-label={`${finalizada ? 100 : porcentaje}% de la campaña transcurrido`}
            >
              <div
                className={`h-full rounded-full ${finalizada ? 'bg-terracota' : 'bg-verde-noche'}`}
                style={{ width: `${finalizada ? 100 : porcentaje}%` }}
              />
            </div>
            <p
              className={`mt-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta ${finalizada ? 'text-terracota-legible' : 'text-nocturno-terciario'}`}
            >
              {finalizada
                ? `Fuera de plazo · ${formatearFechaCorta(d.fechaFin)}`
                : `Quedan ${restantes} ${restantes === 1 ? 'día' : 'días'}`}
            </p>
          </>
        ) : (
          // Filas antiguas y solicitudes que nacieron sin plazo: no se inventa
          // una barra, se dice que no hay fin. La segunda rama cubre el caso
          // teórico de tener fin pero no inicio, que dejaría la fila muda.
          <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-terciario">
            {d.fechaFin ? `Hasta ${formatearFechaCorta(d.fechaFin)}` : 'Sin fecha de fin'}
          </p>
        )}

        {/* Excluyente con "fuera de plazo" por construcción: diasParaCaducar
            exige vigente. */}
        {dias !== null && (
          <p className="mt-1.5">
            <span className="rounded bg-nocturno-outline px-2 py-0.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-oro">
              {textoCaducidad(dias)}
            </span>
          </p>
        )}
      </div>

      {/* mt-auto: con tarjetas de alturas distintas en la misma fila, las
          acciones quedan alineadas abajo en vez de flotando a media altura. */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-terciario">
          Orden {d.orden}
        </span>
        {/* Icono con texto: el lápiz suelto de la tabla dejaba al superadmin
            adivinando, y a un lector de pantalla sin nada que anunciar. */}
        <span className="flex items-center gap-3">
          <button
            onClick={() => onEditar(d)}
            aria-label={`Editar el destacado ${nombre || d.referenciaId}`}
            className="flex items-center gap-1 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-terracota-legible transition-opacity hover:opacity-80"
          >
            <MIcon name="edit" className="text-[18px]" />
            Editar
          </button>
          <button
            onClick={() => onEliminar(d)}
            aria-label={`Eliminar el destacado ${nombre || d.referenciaId}`}
            className="flex items-center gap-1 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-nocturno-secundario transition-colors hover:text-terracota-legible"
          >
            <MIcon name="delete" className="text-[18px]" />
            Eliminar
          </button>
        </span>
      </div>
    </div>
  )
}
