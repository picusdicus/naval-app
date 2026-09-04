import { useState, useEffect, useCallback } from 'react'
import MIcon from '../../MIcon.jsx'
import DialogoConfirmacion from '../DialogoConfirmacion.jsx'
import { LISTA_CATEGORIAS } from '../../../lib/categorias.js'
import { SUBTIPO_INFO } from '../../../lib/subtipos.js'

// Opciones de subtipo ordenadas por etiqueta, una sola vez (mismo patrón que
// TablesComercios.jsx: lista plana, sin filtrar por categoría).
const OPCIONES_SUBTIPO = Object.keys(SUBTIPO_INFO)
  .map((clave) => ({ clave, nombre: SUBTIPO_INFO[clave].nombre }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

const CAMPOS_ENTRADA =
  'w-full border border-filete bg-papel px-3 py-2 font-serif-spectral text-sm text-tinta outline-none focus:border-tinta'
const CAMPOS_LABEL = 'mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo'

export default function TableAltasComercio() {
  const [altas, setAltas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('pendiente')
  const [ocupado, setOcupado] = useState(false)
  const [porRechazar, setPorRechazar] = useState(null)
  const [porAprobar, setPorAprobar] = useState(null)
  const [ficha, setFicha] = useState(null)
  const [errorFicha, setErrorFicha] = useState('')

  const cargar = useCallback(async () => {
    try {
      const respuesta = await fetch(`/api/super/altas-comercio?estado=${estadoFiltro}`)
      if (!respuesta.ok) throw new Error('No se pudieron cargar las solicitudes')

      const datos = await respuesta.json()
      setAltas(datos.altas || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }, [estadoFiltro])

  useEffect(() => {
    setCargando(true)
    cargar()
  }, [cargar])

  const abrirDialogoAprobar = (alta) => {
    setPorAprobar(alta)
    setErrorFicha('')
    setFicha({
      nombre: alta.nombre,
      categoria: alta.categoria,
      subtipo: '',
      direccion: alta.direccion,
      telefono: alta.telefono || '',
      web: '',
      horario: '',
    })
  }

  const actualizarFicha = (campo, valor) => {
    setFicha((prev) => ({ ...prev, [campo]: valor }))
  }

  const confirmarAprobar = async () => {
    const alta = porAprobar
    if (!ficha.subtipo) {
      setErrorFicha('Elige un subtipo antes de aprobar.')
      return
    }
    setOcupado(true)
    setErrorFicha('')
    try {
      const respuesta = await fetch(`/api/super/altas-comercio?id=${alta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'aprobada', ...ficha }),
      })

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(datos.error || 'Error al aprobar')
      }

      await cargar()
      setPorAprobar(null)
      setFicha(null)
    } catch (err) {
      setErrorFicha(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const confirmarRechazar = async () => {
    const alta = porRechazar
    setOcupado(true)
    try {
      const respuesta = await fetch(`/api/super/altas-comercio?id=${alta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'rechazada' }),
      })

      if (!respuesta.ok) {
        const datos = await respuesta.json()
        throw new Error(datos.error || 'Error al rechazar')
      }

      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
      setPorRechazar(null)
    }
  }

  const FILTROS = [
    { valor: 'pendiente', label: 'Pendientes' },
    { valor: 'aprobada', label: 'Aprobadas' },
    { valor: 'rechazada', label: 'Rechazadas' },
  ]

  const nombreCategoria = (id) => LISTA_CATEGORIAS.find((c) => c.id === id)?.nombre || id

  if (cargando) {
    return <p className="font-serif-spectral text-sm text-pardo">Cargando solicitudes…</p>
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((filtro) => (
          <button
            key={filtro.valor}
            onClick={() => setEstadoFiltro(filtro.valor)}
            className={`px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta transition-colors ${
              estadoFiltro === filtro.valor
                ? 'bg-tinta text-papel'
                : 'border border-filete text-pardo hover:text-tinta'
            }`}
          >
            {filtro.label}
          </button>
        ))}
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="flex items-start gap-2 border border-terracota/30 bg-terracota-fondo p-3">
          <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-terracota" />
          <p className="font-serif-spectral text-sm text-terracota">{error}</p>
        </div>
      )}

      {/* Lista de solicitudes */}
      {altas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border border-dashed border-filete-punteado px-6 py-12 text-center">
          <MIcon name="inbox" className="text-[40px] text-mudo" />
          <p className="font-serif-dm text-lg text-tinta">Sin solicitudes</p>
          <p className="max-w-sm font-serif-spectral text-sm text-pardo">
            No hay solicitudes de alta con el estado "{estadoFiltro}".
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {altas.map((a) => (
            <li key={a.id} className="gz-tarjeta-impresa p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif-dm text-lg leading-tight text-tinta">{a.nombre}</h3>
                <span
                  className={`px-2 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta ${
                    a.estado === 'pendiente'
                      ? 'bg-oro text-tinta'
                      : a.estado === 'aprobada'
                        ? 'bg-verde text-papel'
                        : 'bg-filete text-tinta-apagada'
                  }`}
                >
                  {a.estado}
                </span>
              </div>

              <div className="mt-2 space-y-1">
                <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                  {nombreCategoria(a.categoria)}
                </p>
                <p className="font-serif-spectral text-sm text-pardo">{a.direccion}</p>
                {a.telefono && (
                  <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                    {a.telefono}
                  </p>
                )}
                {a.notas && (
                  <p className="line-clamp-2 font-serif-spectral text-sm text-pardo">{a.notas}</p>
                )}
                <p className="font-mono-ibm text-[9px] text-mudo">{a.creadoEn}</p>
              </div>

              {/* Acciones */}
              {a.estado === 'pendiente' && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-filete pt-3">
                  <button
                    onClick={() => abrirDialogoAprobar(a)}
                    disabled={ocupado}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-verde px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-verde transition-colors hover:enabled:bg-verde-fondo disabled:opacity-50 sm:flex-none"
                  >
                    <MIcon name="check_circle" className="text-[16px]" />
                    Aprobar
                  </button>
                  <button
                    onClick={() => setPorRechazar(a)}
                    disabled={ocupado}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-terracota px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota transition-colors hover:enabled:bg-terracota-fondo disabled:opacity-50 sm:flex-none"
                  >
                    <MIcon name="close" className="text-[16px]" />
                    Rechazar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Diálogo de confirmación para rechazar */}
      <DialogoConfirmacion
        abierto={Boolean(porRechazar)}
        titulo="¿Rechazar esta solicitud?"
        mensaje={porRechazar ? `Rechazarás el alta de "${porRechazar.nombre}".` : ''}
        ocupado={ocupado}
        onConfirmar={confirmarRechazar}
        onCancelar={() => setPorRechazar(null)}
      />

      {/* Diálogo de aprobación: revisar/completar la ficha antes de publicarla */}
      {porAprobar && ficha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-lg border border-tinta bg-papel shadow-cartel">
            <div className="h-2 bg-tinta-intensa" />
            <div className="max-h-[85vh] overflow-y-auto p-6">
              <h3 className="mb-1 font-serif-dm text-lg text-tinta">Aprobar alta de comercio</h3>
              <p className="mb-4 font-serif-spectral text-sm text-pardo">
                Completa lo que falte antes de publicar la ficha en el directorio.
              </p>

              <div className="space-y-3">
                <div>
                  <label className={CAMPOS_LABEL}>Nombre</label>
                  <input
                    type="text"
                    value={ficha.nombre}
                    onChange={(e) => actualizarFicha('nombre', e.target.value)}
                    disabled={ocupado}
                    className={CAMPOS_ENTRADA}
                  />
                </div>
                <div>
                  <label className={CAMPOS_LABEL}>Categoría</label>
                  <select
                    value={ficha.categoria}
                    onChange={(e) => actualizarFicha('categoria', e.target.value)}
                    disabled={ocupado}
                    className={CAMPOS_ENTRADA}
                  >
                    {LISTA_CATEGORIAS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={CAMPOS_LABEL}>Subtipo *</label>
                  <select
                    value={ficha.subtipo}
                    onChange={(e) => actualizarFicha('subtipo', e.target.value)}
                    disabled={ocupado}
                    className={CAMPOS_ENTRADA}
                  >
                    <option value="">Elige un subtipo…</option>
                    {OPCIONES_SUBTIPO.map((s) => (
                      <option key={s.clave} value={s.clave}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={CAMPOS_LABEL}>Dirección</label>
                  <input
                    type="text"
                    value={ficha.direccion}
                    onChange={(e) => actualizarFicha('direccion', e.target.value)}
                    disabled={ocupado}
                    className={CAMPOS_ENTRADA}
                  />
                </div>
                <div>
                  <label className={CAMPOS_LABEL}>Teléfono</label>
                  <input
                    type="tel"
                    value={ficha.telefono}
                    onChange={(e) => actualizarFicha('telefono', e.target.value)}
                    disabled={ocupado}
                    className={CAMPOS_ENTRADA}
                  />
                </div>
                <div>
                  <label className={CAMPOS_LABEL}>Web</label>
                  <input
                    type="text"
                    placeholder="https://…"
                    value={ficha.web}
                    onChange={(e) => actualizarFicha('web', e.target.value)}
                    disabled={ocupado}
                    className={CAMPOS_ENTRADA}
                  />
                </div>
                <div>
                  <label className={CAMPOS_LABEL}>Horario</label>
                  <input
                    type="text"
                    placeholder="Lunes a viernes: 09:00–14:00, 17:00–20:00"
                    value={ficha.horario}
                    onChange={(e) => actualizarFicha('horario', e.target.value)}
                    disabled={ocupado}
                    className={CAMPOS_ENTRADA}
                  />
                </div>
              </div>

              {errorFicha && (
                <p className="mt-3 font-serif-spectral text-xs text-terracota">{errorFicha}</p>
              )}

              <div className="mt-4 flex gap-2 border-t border-filete pt-4">
                <button
                  onClick={() => {
                    setPorAprobar(null)
                    setFicha(null)
                  }}
                  disabled={ocupado}
                  className="flex-1 border border-filete px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo transition-colors hover:enabled:text-tinta disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarAprobar}
                  disabled={ocupado}
                  className="gz-boton-tinta flex-1 disabled:opacity-50"
                >
                  {ocupado ? 'Publicando…' : 'Aprobar y publicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
