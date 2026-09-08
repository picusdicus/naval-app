import { useState, useEffect, useMemo } from 'react'
import MIcon from '../../MIcon.jsx'
import { COLORES_DONUT } from '../UmamiStats.jsx'
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
  // Organización itinerante (issue #33): elige el lugar (y el ámbito, dentro
  // o fuera de Navalcarnero) evento a evento en vez de heredar lugarDefecto.
  lugarVariable: false,
}

// Clases compartidas por los campos del formulario: el campo es más oscuro que
// la tarjeta que lo envuelve (sidebar sobre superficie), que es lo que lo hace
// leer como hundido y editable sin inventar un tono nuevo para el tema oscuro.
const CLASES_CAMPO =
  'w-full border border-nocturno-outline bg-nocturno-sidebar px-3.5 py-2.5 font-serif-spectral text-sm text-nocturno-texto focus:border-terracota focus:outline-none'
const CLASES_ETIQUETA =
  'mb-1.5 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-secundario'
// Botón secundario del formulario (Cancelar, Restablecer contraseña).
const CLASES_BOTON_SECUNDARIO =
  'border border-nocturno-outline px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-nocturno-texto hover:bg-nocturno-sidebar'

/**
 * Color del cuadrado de la inicial. Depende solo del id, así que una misma
 * organización conserva su color entre recargas y reordenaciones de la lista.
 *
 * Suma el id ENTERO: con solo el primer carácter, que en un uuid es casi
 * siempre un dígito hexadecimal, 6 de las 9 organizaciones reales caían en el
 * mismo color. No busca un reparto perfecto —para eso haría falta un hash de
 * verdad—, solo romper esa concentración sin dejar de ser determinista.
 */
function colorDeOrganizacion(id) {
  const texto = id || ''
  let suma = 0
  for (let i = 0; i < texto.length; i++) suma += texto.charCodeAt(i)
  return COLORES_DONUT[suma % COLORES_DONUT.length]
}

/**
 * Tinta de la inicial sobre su cuadrado de color: el ocre de la paleta del
 * donut es demasiado claro para texto claro (2.6:1) mientras que el resto lo
 * exige, así que se decide por luminancia en vez de fijar un solo color.
 */
function tintaSobre(hex) {
  const canales = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  const luminancia = 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2]
  return luminancia > 0.2 ? '#211d15' : '#f4efe1'
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
  // Sección "Usuarios y acceso" de la edición: usuarios de la organización y
  // restablecimiento de contraseña por el superadmin.
  const [usuariosOrg, setUsuariosOrg] = useState([])
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false)
  const [resetUsuarioId, setResetUsuarioId] = useState(null)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [guardandoPassword, setGuardandoPassword] = useState(false)
  const [avisoPassword, setAvisoPassword] = useState('')

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

  const cargarUsuariosOrg = async (orgId) => {
    setCargandoUsuarios(true)
    setUsuariosOrg([])
    try {
      const res = await fetch(`/api/super/usuarios?organizacionId=${orgId}`)
      const datos = await res.json()
      if (res.ok) setUsuariosOrg(datos.usuarios || [])
    } catch {
      // La sección de acceso es secundaria: si falla, el resto del formulario sigue siendo útil.
    } finally {
      setCargandoUsuarios(false)
    }
  }

  const restablecerPassword = async (usuario) => {
    setGuardandoPassword(true)
    setError('')
    setAvisoPassword('')
    try {
      const res = await fetch(`/api/super/usuarios?id=${usuario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nuevaPassword }),
      })
      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'No se pudo restablecer la contraseña.')
      setAvisoPassword(`Contraseña de ${usuario.email} actualizada. Recuerda hacérsela llegar al gestor.`)
      setResetUsuarioId(null)
      setNuevaPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardandoPassword(false)
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
      lugarVariable: org.lugarVariable === true,
    })
    setEditandoId(org.id)
    setBusquedaComercio('')
    setResetUsuarioId(null)
    setNuevaPassword('')
    setAvisoPassword('')
    setMostrarFormulario(true)
    cargarUsuariosOrg(org.id)
  }

  const cancelar = () => {
    setMostrarFormulario(false)
    setEditandoId(null)
    setFormularioData(FORMULARIO_VACIO)
    setBusquedaComercio('')
    setError('')
    setUsuariosOrg([])
    setResetUsuarioId(null)
    setNuevaPassword('')
    setAvisoPassword('')
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-8">
        {/* La pista del giro va en un tono de la propia paleta oscura: el
            filete claro se veía, pero tan brillante que el arco terracota
            dejaba de distinguirse del resto del anillo. */}
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
            Nueva organización
          </button>

          {organizaciones.length === 0 ? (
            <p className="py-8 text-center font-serif-spectral text-sm text-nocturno-secundario">
              Todavía no hay organizaciones dadas de alta. Empieza por la tuya.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {organizaciones.map((org) => (
                <TarjetaOrganizacion
                  key={org.id}
                  org={org}
                  onCambiarEstado={cambiarEstado}
                  onEditar={abrirEdicion}
                />
              ))}

              {/* El alta cierra la rejilla como una celda más: queda donde
                  termina la lista, sin sacar al superadmin del recorrido.
                  El aria-label la distingue del botón de la cabecera, que
                  rotula igual: quien navega con lector de pantalla oía dos
                  "Nueva organización" seguidos sin saber que uno es una
                  tarjeta al final de la rejilla. */}
              <button
                type="button"
                aria-label="Añadir una organización nueva"
                onClick={() => setMostrarFormulario(true)}
                className="flex min-h-[9rem] items-center justify-center gap-2 rounded-2xl border border-dashed border-nocturno-outline p-5 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-nocturno-secundario transition-colors hover:border-terracota hover:text-terracota-legible"
              >
                <MIcon name="add" className="text-[20px]" />
                Nueva organización
              </button>
            </div>
          )}
        </>
      ) : (
        // colorScheme dark es lo único que no es un cambio de clase: sin ella,
        // el desplegable nativo de categoría lo pinta el sistema operativo con
        // su tema claro y abre un panel blanco dentro del formulario oscuro.
        <div className="max-w-2xl" style={{ colorScheme: 'dark' }}>
          <div className="rounded-2xl border border-nocturno-borde bg-nocturno-superficie p-6">
            <h2 className="mb-4 font-serif-dm text-2xl text-nocturno-texto">
              {editandoId ? 'Editar organización' : 'Nueva organización'}
            </h2>

            <form onSubmit={manejarEnvio} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={CLASES_ETIQUETA}>Nombre</label>
                  <input
                    type="text"
                    value={formularioData.nombre}
                    onChange={(e) =>
                      setFormularioData({ ...formularioData, nombre: e.target.value })
                    }
                    className={CLASES_CAMPO}
                    disabled={enviando}
                  />
                </div>
                <div>
                  <label className={CLASES_ETIQUETA}>Slug</label>
                  <input
                    type="text"
                    value={formularioData.slug}
                    onChange={(e) =>
                      setFormularioData({ ...formularioData, slug: e.target.value })
                    }
                    className={CLASES_CAMPO}
                    disabled={enviando}
                  />
                </div>
              </div>

              <div>
                <label className={CLASES_ETIQUETA}>Descripción</label>
                <textarea
                  value={formularioData.descripcion}
                  onChange={(e) =>
                    setFormularioData({ ...formularioData, descripcion: e.target.value })
                  }
                  className={CLASES_CAMPO}
                  rows="3"
                  disabled={enviando}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className={CLASES_ETIQUETA}>Email de contacto</label>
                  <input
                    type="email"
                    value={formularioData.emailContacto}
                    onChange={(e) =>
                      setFormularioData({ ...formularioData, emailContacto: e.target.value })
                    }
                    className={CLASES_CAMPO}
                    disabled={enviando}
                  />
                </div>
                <div>
                  <label className={CLASES_ETIQUETA}>Teléfono</label>
                  <input
                    type="tel"
                    value={formularioData.telefono}
                    onChange={(e) =>
                      setFormularioData({ ...formularioData, telefono: e.target.value })
                    }
                    className={CLASES_CAMPO}
                    disabled={enviando}
                  />
                </div>
                <div>
                  <label className={CLASES_ETIQUETA}>Sitio web</label>
                  <input
                    type="url"
                    value={formularioData.web}
                    onChange={(e) =>
                      setFormularioData({ ...formularioData, web: e.target.value })
                    }
                    className={CLASES_CAMPO}
                    disabled={enviando}
                  />
                </div>
              </div>

              {/* Perfil de eventos: cada evento de la organización se publica
                  con esta categoría y este lugar (el gestor los ve como solo
                  lectura en su formulario). Sin ambos, no puede publicar. */}
              <div>
                <p className="mb-2 text-sm font-semibold text-nocturno-texto">
                  Perfil de eventos
                  <span className="ml-1.5 normal-case tracking-normal text-nocturno-terciario">
                    (sin categoría y lugar, la organización no puede publicar eventos)
                  </span>
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={CLASES_ETIQUETA}>Categoría por defecto</label>
                    <select
                      value={formularioData.categoriaDefecto}
                      onChange={(e) =>
                        setFormularioData({ ...formularioData, categoriaDefecto: e.target.value })
                      }
                      className={CLASES_CAMPO}
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
                    <label className={CLASES_ETIQUETA}>Lugar por defecto</label>
                    <input
                      type="text"
                      value={formularioData.lugarDefecto}
                      onChange={(e) =>
                        setFormularioData({ ...formularioData, lugarDefecto: e.target.value })
                      }
                      placeholder="P. ej. Teatro Centro, Navalcarnero"
                      className={CLASES_CAMPO}
                      disabled={enviando}
                    />
                  </div>
                </div>

                {/* Organización itinerante (issue #33): con el toggle activo, el
                    gestor elige el lugar evento a evento (desplegable de sitios
                    de Navalcarnero + texto libre, o lugar y población fuera del
                    municipio) y el servidor deja de imponer lugarDefecto, que
                    pasa a ser solo el valor de partida del formulario. */}
                <label className="mt-4 flex items-start gap-2.5 font-serif-spectral text-sm text-nocturno-texto">
                  <input
                    type="checkbox"
                    checked={formularioData.lugarVariable}
                    onChange={(e) =>
                      setFormularioData({ ...formularioData, lugarVariable: e.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 accent-terracota"
                    disabled={enviando}
                  />
                  <span>
                    Lugar variable por evento
                    <span className="block font-serif-spectral text-[12.5px] text-nocturno-secundario">
                      Para organizaciones itinerantes: cada evento indica su propio lugar, dentro o
                      fuera de Navalcarnero. Los de fuera no salen en la agenda pública ni en los
                      avisos, solo en la ficha de su comercio.
                    </span>
                  </span>
                </label>
              </div>

              {/* Vincula la cuenta con su ficha del directorio: habilita que la
                  organización solicite destacar su negocio desde /panel. */}
              <div>
                <label className={CLASES_ETIQUETA}>
                  Negocio vinculado
                  <span className="ml-1.5 normal-case tracking-normal text-nocturno-terciario">
                    (opcional)
                  </span>
                </label>
                {formularioData.comercioId ? (
                  <div className="flex items-center justify-between border border-nocturno-outline bg-nocturno-sidebar px-4 py-2">
                    <span className="inline-flex items-center gap-2 font-serif-spectral text-sm font-medium text-nocturno-texto">
                      <MIcon name="storefront" className="text-[18px] text-terracota-legible" />
                      {COMERCIOS_POR_ID.get(formularioData.comercioId)?.nombre || (
                        <span className="text-terracota-legible" title={formularioData.comercioId}>
                          Referencia no encontrada
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormularioData({ ...formularioData, comercioId: '' })}
                      className="text-nocturno-terciario hover:text-terracota-legible"
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
                      className={CLASES_CAMPO}
                      disabled={enviando}
                    />
                    {candidatosComercio.length > 0 && (
                      <ul className="mt-1 divide-y divide-nocturno-borde overflow-hidden border border-nocturno-outline bg-nocturno-superficie">
                        {candidatosComercio.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setFormularioData({ ...formularioData, comercioId: c.id })
                                setBusquedaComercio('')
                              }}
                              className="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left font-serif-spectral text-sm text-nocturno-texto hover:bg-nocturno-sidebar"
                            >
                              <span className="font-medium">{c.nombre}</span>
                              <span className="shrink-0 font-mono-ibm text-[10px] text-nocturno-terciario">
                                {c.detalle}
                              </span>
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

            {/* Fuera del <form> a propósito: así el Enter en el campo de la
                nueva contraseña no dispara el guardado de la organización. */}
            {editandoId && (
              <div className="mt-8 border-t border-nocturno-borde pt-6">
                <h3 className="mb-1 font-serif-dm text-xl text-nocturno-texto">Usuarios y acceso</h3>
                <p className="mb-4 font-serif-spectral text-sm text-nocturno-secundario">
                  Restablece la contraseña de un gestor que no puede entrar. No se envía
                  ningún email: la nueva contraseña se la haces llegar tú.
                </p>

                {avisoPassword && (
                  <div className="mb-4 flex items-start gap-2 border border-verde-noche/30 bg-verde-noche/10 p-3">
                    <MIcon name="check_circle" className="mt-0.5 flex-shrink-0 text-[20px] text-verde-noche" />
                    <p className="font-serif-spectral text-sm font-medium text-verde-noche">{avisoPassword}</p>
                  </div>
                )}

                {cargandoUsuarios ? (
                  <p className="font-serif-spectral text-sm text-nocturno-terciario">Cargando usuarios…</p>
                ) : usuariosOrg.length === 0 ? (
                  <p className="font-serif-spectral text-sm text-nocturno-secundario">
                    Esta organización no tiene usuarios registrados. Crea un código en la
                    pestaña «Códigos de invitación» para que su gestor se dé de alta en /registro.
                  </p>
                ) : (
                  <ul className="divide-y divide-nocturno-borde border border-nocturno-borde">
                    {usuariosOrg.map((u) => (
                      <li key={u.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-serif-spectral text-sm font-medium text-nocturno-texto">{u.email}</p>
                            <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-terciario">
                              {u.nombre} · {u.rol}
                              {!u.activo && ' · inactivo'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setResetUsuarioId(resetUsuarioId === u.id ? null : u.id)
                              setNuevaPassword('')
                            }}
                            className="border border-nocturno-outline px-3 py-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-texto hover:bg-nocturno-sidebar"
                          >
                            {resetUsuarioId === u.id ? 'Cerrar' : 'Restablecer contraseña'}
                          </button>
                        </div>
                        {resetUsuarioId === u.id && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <input
                              type="text"
                              value={nuevaPassword}
                              onChange={(e) => setNuevaPassword(e.target.value)}
                              placeholder="Nueva contraseña (mínimo 8 caracteres)"
                              className="min-w-[220px] flex-1 border border-nocturno-outline bg-nocturno-sidebar px-3.5 py-2 font-serif-spectral text-sm text-nocturno-texto focus:border-terracota focus:outline-none"
                              disabled={guardandoPassword}
                            />
                            <button
                              type="button"
                              onClick={() => restablecerPassword(u)}
                              disabled={guardandoPassword || nuevaPassword.length < 8}
                              className="bg-terracota px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                            >
                              {guardandoPassword ? 'Guardando…' : 'Guardar'}
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Una organización de la rejilla: identidad arriba, cifras y acceso a la edición. */
function TarjetaOrganizacion({ org, onCambiarEstado, onEditar }) {
  const color = colorDeOrganizacion(org.id)
  // Las tres cifras en el orden en que se pintan: el empate lo gana la primera,
  // así que este orden ES el criterio de desempate (Eventos > Usuarios > Códigos).
  // Los COUNT(*) llegan de Neon como texto, de ahí el Number: sin él ninguna
  // cifra empataba con el máximo y nunca se destacaba ninguna.
  const cifras = [
    { etiqueta: 'Eventos', valor: Number(org.eventosCount) || 0 },
    { etiqueta: 'Usuarios', valor: Number(org.usuariosCount) || 0 },
    { etiqueta: 'Códigos', valor: Number(org.codigosActivosCount) || 0 },
  ]
  const maximo = Math.max(...cifras.map((c) => c.valor))
  // Con las tres a cero no hay nada que destacar: resaltar un 0 como "la más
  // alta" sugeriría actividad donde no la hay.
  const indiceDestacado = maximo > 0 ? cifras.findIndex((c) => c.valor === maximo) : -1

  return (
    // min-w-0: sin él, la celda de la rejilla se ensancha hasta caber el slug
    // más largo (los `gpl_…` del directorio) y desborda la página en móvil.
    <div
      data-testid="tarjeta-organizacion"
      className="min-w-0 rounded-2xl border border-nocturno-borde bg-nocturno-superficie p-5"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-serif-dm text-xl"
          style={{ backgroundColor: color, color: tintaSobre(color) }}
          aria-hidden="true"
        >
          {(org.nombre || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif-dm text-lg leading-tight text-nocturno-texto" title={org.nombre}>
            {org.nombre}
          </p>
          <p className="truncate font-mono-ibm text-xs text-nocturno-secundario" title={org.slug}>
            {org.slug}
          </p>
        </div>
        <button
          onClick={() => onCambiarEstado(org.id, !org.activa)}
          className={`shrink-0 rounded-full px-3 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta transition-opacity hover:opacity-80 ${
            org.activa ? 'bg-verde-noche text-tinta' : 'bg-terracota text-papel'
          }`}
        >
          {org.activa ? 'Activa' : 'Inactiva'}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {cifras.map((cifra, i) => (
          <div key={cifra.etiqueta}>
            <p
              className={`font-serif-dm text-2xl leading-none ${
                i === indiceDestacado ? 'text-terracota-legible' : 'text-nocturno-texto'
              }`}
            >
              {cifra.valor}
            </p>
            <p className="mt-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-terciario">
              {cifra.etiqueta}
            </p>
          </div>
        ))}
      </div>

      {org.comercioId && (
        <p className="mt-4 flex items-center gap-1 font-mono-ibm text-[10px] text-nocturno-terciario">
          <MIcon name="storefront" className="text-[14px]" />
          <span className="truncate">
            {COMERCIOS_POR_ID.get(org.comercioId)?.nombre || org.comercioId}
          </span>
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => onEditar(org)}
          className="font-mono-ibm text-[11px] uppercase tracking-etiqueta text-terracota-legible transition-opacity hover:opacity-80"
        >
          Editar →
        </button>
      </div>
    </div>
  )
}
