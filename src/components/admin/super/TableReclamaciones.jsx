import { useState, useEffect, useCallback } from 'react'
import MIcon from '../../MIcon.jsx'
import DialogoConfirmacion from '../DialogoConfirmacion.jsx'

export default function TableReclamaciones() {
  const [reclamaciones, setReclamaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('pendiente')
  const [ocupado, setOcupado] = useState(false)
  const [porRechazar, setPorRechazar] = useState(null)
  const [porAprobar, setPorAprobar] = useState(null)
  const [esCultural, setEsCultural] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const respuesta = await fetch(`/api/super/reclamaciones?estado=${estadoFiltro}`)
      if (!respuesta.ok) throw new Error('No se pudieron cargar las solicitudes')

      const datos = await respuesta.json()
      setReclamaciones(datos.reclamaciones || [])
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

  const abrirDialogoAprobar = (reclamacion) => {
    setPorAprobar(reclamacion)
    setEsCultural(false)
  }

  const confirmarAprobar = async () => {
    const reclamacion = porAprobar
    setOcupado(true)
    try {
      const respuesta = await fetch(`/api/super/reclamaciones?id=${reclamacion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'aprobada', esOrganizacionCultural: esCultural }),
      })

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(datos.error || 'Error al aprobar')
      }

      // Actualizar lista
      await cargar()
      setPorAprobar(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const confirmarRechazar = async () => {
    const reclamacion = porRechazar
    setOcupado(true)
    try {
      const respuesta = await fetch(`/api/super/reclamaciones?id=${reclamacion.id}`, {
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
      {reclamaciones.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border border-dashed border-filete-punteado px-6 py-12 text-center">
          <MIcon name="inbox" className="text-[40px] text-mudo" />
          <p className="font-serif-dm text-lg text-tinta">Sin solicitudes</p>
          <p className="max-w-sm font-serif-spectral text-sm text-pardo">
            No hay solicitudes de reclamación con el estado "{estadoFiltro}".
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reclamaciones.map((r) => (
            <li key={r.id} className="gz-tarjeta-impresa p-4 sm:p-5">
              <div className="flex gap-4">
                {r.detallesComercio?.foto && (
                  <img
                    src={r.detallesComercio.foto}
                    alt=""
                    className="h-14 w-14 flex-shrink-0 border border-filete object-cover sm:h-20 sm:w-20"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif-dm text-lg leading-tight text-tinta">
                      {r.detallesComercio?.nombre || r.comercioId}
                    </h3>
                    <span
                      className={`px-2 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta ${
                        r.estado === 'pendiente'
                          ? 'bg-oro text-tinta'
                          : r.estado === 'aprobada'
                            ? 'bg-verde text-papel'
                            : 'bg-filete text-tinta-apagada'
                      }`}
                    >
                      {r.estado}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1">
                    <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                      Solicitante: {r.nombre}
                    </p>
                    <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                      {r.email}
                      {r.telefono && ` · ${r.telefono}`}
                    </p>
                    <p className="line-clamp-2 font-serif-spectral text-sm text-pardo">
                      {r.mensaje}
                    </p>
                    <p className="font-mono-ibm text-[9px] text-mudo">{r.creadoEn}</p>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-filete pt-3">
                {r.estado === 'pendiente' && (
                  <>
                    <button
                      onClick={() => abrirDialogoAprobar(r)}
                      disabled={ocupado}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-verde px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-verde transition-colors hover:enabled:bg-verde-fondo disabled:opacity-50 sm:flex-none"
                    >
                      <MIcon name="check_circle" className="text-[16px]" />
                      Aprobar
                    </button>
                    <button
                      onClick={() => setPorRechazar(r)}
                      disabled={ocupado}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-terracota px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota transition-colors hover:enabled:bg-terracota-fondo disabled:opacity-50 sm:flex-none"
                    >
                      <MIcon name="close" className="text-[16px]" />
                      Rechazar
                    </button>
                  </>
                )}

                {r.estado === 'aprobada' && (
                  <div className="flex-1 rounded bg-verde-fondo p-2 sm:flex-none">
                    <p className="font-mono-ibm text-[9px] uppercase tracking-etiqueta text-verde">
                      Código: <span className="font-bold">{r.codigo}</span>
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(r.codigo)
                      }}
                      className="mt-1 text-[10px] font-semibold text-verde underline hover:no-underline"
                    >
                      Copiar código
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Diálogo de confirmación para rechazar */}
      <DialogoConfirmacion
        abierto={Boolean(porRechazar)}
        titulo="¿Rechazar esta solicitud?"
        mensaje={porRechazar ? `Rechazarás la reclamación de ${porRechazar.nombre}.` : ''}
        ocupado={ocupado}
        onConfirmar={confirmarRechazar}
        onCancelar={() => setPorRechazar(null)}
      />

      {/* Diálogo de aprobación */}
      {porAprobar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-tinta bg-papel shadow-cartel">
            <div className="h-2 bg-tinta-intensa" />
            <div className="p-6">
              <h3 className="mb-3 font-serif-dm text-lg text-tinta">Aprobar reclamación</h3>
              <p className="mb-4 font-serif-spectral text-sm text-pardo">
                {porAprobar.detallesComercio?.nombre || porAprobar.comercioId}
              </p>

              <div className="mb-4 space-y-3 border-t border-filete pt-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={esCultural}
                    onChange={(e) => setEsCultural(e.target.checked)}
                    disabled={ocupado}
                    className="h-4 w-4 cursor-pointer accent-tinta"
                  />
                  <span className="font-serif-spectral text-sm text-tinta">
                    ¿Es una organización cultural? (podrá gestionar eventos)
                  </span>
                </label>
              </div>

              <div className="flex gap-2 border-t border-filete pt-4">
                <button
                  onClick={() => setPorAprobar(null)}
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
                  {ocupado ? 'Aprobando…' : 'Aprobar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
