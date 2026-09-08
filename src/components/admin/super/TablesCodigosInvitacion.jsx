import { useState, useEffect } from 'react'
import MIcon from '../../MIcon.jsx'

// Clases compartidas con el formulario de Organizaciones. Se copian en vez de
// extraerse a un módulo común: son tres cadenas, y un fichero nuevo para dos
// consumidores esconde el mapeo más de lo que lo unifica.
const CLASES_CAMPO =
  'w-full border border-nocturno-outline bg-nocturno-sidebar px-3.5 py-2.5 font-serif-spectral text-sm text-nocturno-texto focus:border-terracota focus:outline-none'
const CLASES_ETIQUETA =
  'mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-secundario'
const CLASES_BOTON_SECUNDARIO =
  'border border-nocturno-outline px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-nocturno-texto hover:bg-nocturno-sidebar'

/**
 * Color de la pastilla de estado y de la barra de usos.
 *
 * "agotado" era `bg-warning/20 text-warning` y `warning` no existe en
 * tailwind.config.js: la pastilla salía sin color ninguno. Se le da ocre, que
 * en el panel ya significa "atención, pero no es un error" — a diferencia del
 * terracota de "caducado", que sí marca algo que ya no sirve.
 */
const COLORES_ESTADO = {
  activo: { pastilla: 'bg-verde-noche text-tinta', barra: 'bg-verde-noche' },
  agotado: { pastilla: 'bg-ocre text-tinta', barra: 'bg-ocre' },
  caducado: { pastilla: 'bg-terracota text-papel', barra: 'bg-terracota' },
}
const COLOR_ESTADO_NEUTRO = {
  pastilla: 'bg-nocturno-outline text-nocturno-texto',
  barra: 'bg-nocturno-outline',
}

const colorDeEstado = (estado) => COLORES_ESTADO[estado] || COLOR_ESTADO_NEUTRO

const fechaCorta = (valor) =>
  new Date(valor).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

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
          {/* El desplegable nativo del filtro lo pinta el sistema operativo:
              sin colorScheme abre un panel blanco sobre la barra oscura. */}
          <div className="mb-4 flex flex-wrap gap-2" style={{ colorScheme: 'dark' }}>
            <button
              onClick={() => setMostrarFormulario(true)}
              className="flex items-center gap-2 bg-terracota px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel hover:opacity-90 active:scale-[0.98]"
            >
              <MIcon name="add" className="text-[20px]" />
              Nuevo código
            </button>
            <select
              value={filtroOrg}
              onChange={(e) => setFiltroOrg(e.target.value)}
              aria-label="Filtrar por organización"
              className="border border-nocturno-outline bg-nocturno-sidebar px-3 py-2 font-serif-spectral text-sm text-nocturno-texto focus:border-terracota focus:outline-none"
            >
              <option value="">Todas las organizaciones</option>
              {organizaciones.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.nombre}
                </option>
              ))}
            </select>
          </div>

          {codigosFiltrados.length === 0 ? (
            <p className="py-8 text-center font-serif-spectral text-sm text-nocturno-secundario">
              {filtroOrg
                ? 'Esta organización no tiene códigos de invitación.'
                : 'Todavía no hay códigos generados. Crea el primero desde el botón de arriba.'}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {codigosFiltrados.map((codigo) => (
                <TarjetaCodigo
                  key={codigo.id}
                  codigo={codigo}
                  nombreOrg={obtenerNombreOrg(codigo.organizacionId)}
                  onCopiar={copioCodigo}
                />
              ))}

              {/* El alta cierra la rejilla como una celda más. El aria-label la
                  distingue del botón de la cabecera, que rotula igual: con
                  lector de pantalla se oían dos "Nuevo código" seguidos. */}
              <button
                type="button"
                aria-label="Añadir un código nuevo"
                onClick={() => setMostrarFormulario(true)}
                className="flex min-h-[9rem] items-center justify-center gap-2 rounded-2xl border border-dashed border-nocturno-outline p-5 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-nocturno-secundario transition-colors hover:border-terracota hover:text-terracota-legible"
              >
                <MIcon name="add" className="text-[20px]" />
                Nuevo código
              </button>
            </div>
          )}
        </>
      ) : (
        // colorScheme dark: los dos desplegables (Organización y Rol) y el
        // selector de fecha los pinta el sistema, no las clases.
        <div className="max-w-2xl" style={{ colorScheme: 'dark' }}>
          <div className="rounded-2xl border border-nocturno-borde bg-nocturno-superficie p-6">
            <h2 className="mb-4 font-serif-dm text-2xl text-nocturno-texto">
              Generar nuevo código de invitación
            </h2>

            <form onSubmit={manejarEnvio} className="space-y-4">
              <div>
                <label className={CLASES_ETIQUETA}>Organización *</label>
                <select
                  value={formularioData.organizacionId}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, organizacionId: e.target.value })
                  }
                  className={CLASES_CAMPO}
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
                  <label className={CLASES_ETIQUETA}>Rol *</label>
                  <select
                    value={formularioData.rolConcedido}
                    onChange={(e) =>
                      setFormularioData({ ...formularioData, rolConcedido: e.target.value })
                    }
                    className={CLASES_CAMPO}
                    disabled={enviando}
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                  </select>
                </div>

                <div>
                  <label className={CLASES_ETIQUETA}>Usos máximos *</label>
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
                    className={CLASES_CAMPO}
                    disabled={enviando}
                  />
                </div>

                <div>
                  <label className={CLASES_ETIQUETA}>Fecha de caducidad</label>
                  <input
                    type="date"
                    value={formularioData.expiracion}
                    onChange={(e) =>
                      setFormularioData({ ...formularioData, expiracion: e.target.value })
                    }
                    className={CLASES_CAMPO}
                    disabled={enviando}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={enviando || !formularioData.organizacionId}
                  className="bg-terracota px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                >
                  {enviando ? 'Generando…' : 'Generar código'}
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
    </div>
  )
}

function TarjetaCodigo({ codigo, nombreOrg, onCopiar }) {
  // El estado lo calcula el backend (activo/agotado/caducado/inactivo) mirando
  // activo, expiración y usos a la vez: recalcular aquí solo la parte de los
  // usos daría un criterio distinto al de la propia pastilla.
  const { pastilla, barra } = colorDeEstado(codigo.estado)
  const maximos = Math.max(1, Number(codigo.usosMaximos) || 1)
  const usados = Math.min(Number(codigo.usosActuales) || 0, maximos)
  const porcentaje = Math.round((usados / maximos) * 100)

  // Sin expiración no se inventa una cuenta atrás: se dice que no la hay,
  // igual que "Sin fecha de fin" en los destacados en curso del Resumen.
  const caducidad = !codigo.expiracion
    ? 'Sin fecha de caducidad'
    : `${codigo.estado === 'caducado' ? 'Caducó' : 'Caduca'} el ${fechaCorta(codigo.expiracion)}`

  return (
    // min-w-0: sin él la celda se ensancha hasta caber el nombre de
    // organización más largo y desborda la rejilla en móvil.
    <div
      data-testid="tarjeta-codigo"
      className="min-w-0 rounded-2xl border border-nocturno-borde bg-nocturno-superficie p-5"
    >
      <div className="flex items-start justify-between gap-3">
        {/* El código es lo primero que se busca al mirar la tarjeta: manda en
            tamaño sobre todo lo demás. */}
        <p className="min-w-0 break-all font-mono-ibm text-xl font-medium leading-tight text-verde-noche">
          {codigo.codigo}
        </p>
        <span
          className={`shrink-0 rounded-full px-3 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta ${pastilla}`}
        >
          {codigo.estado.charAt(0).toUpperCase() + codigo.estado.slice(1)}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <p
          className="min-w-0 flex-1 truncate font-serif-spectral text-sm text-nocturno-texto"
          title={nombreOrg}
        >
          {nombreOrg}
        </p>
        <span className="shrink-0 rounded bg-nocturno-outline px-2 py-0.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-secundario">
          {codigo.rolConcedido}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-terciario">
          <span>Usos</span>
          <span className="text-nocturno-texto">
            {codigo.usosActuales}/{codigo.usosMaximos}
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-nocturno-outline"
          role="img"
          aria-label={`${usados} de ${maximos} usos consumidos`}
        >
          <div className={`h-full rounded-full ${barra}`} style={{ width: `${porcentaje}%` }} />
        </div>
        <p className="mt-2 font-mono-ibm text-[10px] text-nocturno-terciario">{caducidad}</p>
      </div>

      <div className="mt-4 flex justify-end">
        {/* Icono con texto: un botón de solo icono deja al superadmin
            adivinando qué copia, y al lector de pantalla sin el código. */}
        <button
          onClick={() => onCopiar(codigo.codigo)}
          aria-label={`Copiar código ${codigo.codigo}`}
          className="flex items-center gap-1.5 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-terracota-legible transition-opacity hover:opacity-80"
        >
          <MIcon name="content_copy" className="text-[18px]" />
          Copiar
        </button>
      </div>
    </div>
  )
}
