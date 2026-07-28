import { useMemo, useState } from 'react'
import comerciosData from '../../../data/comercios.json'
import overridesActuales from '../../../data/comercios-overrides.json'
import { LISTA_CATEGORIAS } from '../../../lib/categorias.js'
import { SUBTIPO_INFO, infoSubtipo } from '../../../lib/subtipos.js'
import MIcon from '../../MIcon.jsx'

// Tab "Comercios" del panel superadmin: recategorizar (o excluir) entradas del
// directorio que Google trae mal clasificadas, y crear categorías o
// subcategorías nuevas si no existen. Los cambios se acumulan y al guardar se
// hace UN commit a GitHub (overrides + comercios.json + taxonomía extra) vía
// POST /api/super/comercios; el redeploy de Vercel los publica en ~2 min.
//
// Solo se editan las entradas de Google Places (id gpl_…): los servicios
// curados (local/…) se mantienen a mano en servicios-locales.json.

const MAX_FILAS = 80
const NUEVA = '__nueva__'
const COLOR_DEFECTO = '#7A5C46'

// Opciones de subtipo ordenadas por etiqueta, una sola vez.
const OPCIONES_SUBTIPO = Object.keys(SUBTIPO_INFO)
  .map((clave) => ({ clave, nombre: SUBTIPO_INFO[clave].nombre }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

const ES_GENERICO = (subtipo) => subtipo === 'shop' || subtipo === 'service'

// "Ocio nocturno" → "ocio_nocturno" (sin acentos, solo a-z/0-9/_).
function slugDe(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
}

export default function TablesComercios() {
  const [busqueda, setBusqueda] = useState('')
  const [soloGenericos, setSoloGenericos] = useState(true)
  const [cambios, setCambios] = useState({})
  const [nuevasCategorias, setNuevasCategorias] = useState({})
  const [nuevosSubtipos, setNuevosSubtipos] = useState({})
  // Mini-formulario de creación: { tipo: 'categoria'|'subtipo', comercio }.
  const [creando, setCreando] = useState(null)
  const [formNombre, setFormNombre] = useState('')
  const [formColor, setFormColor] = useState(COLOR_DEFECTO)
  const [formIcono, setFormIcono] = useState('')
  const [formError, setFormError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState(null) // { tipo: 'ok'|'error', texto }

  const base = useMemo(() => comerciosData.filter((c) => c.id.startsWith('gpl_')), [])

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return base.filter((c) => {
      if (soloGenericos && !ES_GENERICO(c.subtipo) && !cambios[c.id]) return false
      if (!texto) return true
      return (
        c.nombre.toLowerCase().includes(texto) ||
        (c.tipoDisplay || '').toLowerCase().includes(texto) ||
        (c.direccion || '').toLowerCase().includes(texto)
      )
    })
  }, [base, busqueda, soloGenericos, cambios])

  const visibles = filtrados.slice(0, MAX_FILAS)
  const totalCambios = Object.keys(cambios).length
  const totalNuevas = Object.keys(nuevasCategorias).length + Object.keys(nuevosSubtipos).length

  const opcionesCategoria = useMemo(
    () => [
      ...LISTA_CATEGORIAS.map((c) => ({ clave: c.id, nombre: c.nombre })),
      ...Object.entries(nuevasCategorias).map(([clave, d]) => ({
        clave,
        nombre: `${d.nombre} (nueva)`,
      })),
    ],
    [nuevasCategorias],
  )

  const opcionesSubtipo = useMemo(
    () => [
      ...OPCIONES_SUBTIPO,
      ...Object.entries(nuevosSubtipos).map(([clave, d]) => ({
        clave,
        nombre: `${d.nombre} (nueva)`,
      })),
    ],
    [nuevosSubtipos],
  )

  function valorActual(comercio) {
    return cambios[comercio.id] || { categoria: comercio.categoria, subtipo: comercio.subtipo }
  }

  function registrarCambio(comercio, parcial) {
    setMensaje(null)
    setCambios((previos) => {
      const actual = previos[comercio.id] || {
        categoria: comercio.categoria,
        subtipo: comercio.subtipo,
      }
      const siguiente = { ...actual, ...parcial }
      const sinCambios =
        siguiente.excluir !== true &&
        siguiente.categoria === comercio.categoria &&
        siguiente.subtipo === comercio.subtipo
      const copia = { ...previos }
      if (sinCambios) delete copia[comercio.id]
      else copia[comercio.id] = siguiente
      return copia
    })
  }

  function abrirCreacion(tipo, comercio) {
    setCreando({ tipo, comercio })
    setFormNombre('')
    setFormColor(COLOR_DEFECTO)
    setFormIcono('')
    setFormError(null)
  }

  function confirmarCreacion() {
    const nombre = formNombre.trim()
    if (nombre.length < 2) {
      setFormError('El nombre necesita al menos 2 caracteres.')
      return
    }
    const clave = slugDe(nombre)
    if (!clave || clave.length < 2) {
      setFormError('No se pudo derivar un identificador del nombre.')
      return
    }
    const existentes =
      creando.tipo === 'categoria'
        ? new Set([...opcionesCategoria.map((o) => o.clave)])
        : new Set([...opcionesSubtipo.map((o) => o.clave)])
    if (existentes.has(clave)) {
      setFormError(`Ya existe una con el identificador «${clave}».`)
      return
    }
    const icono = formIcono.trim() || 'storefront'
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(icono)) {
      setFormError('El icono debe ser un nombre de Material Symbol (minúsculas y _).')
      return
    }

    if (creando.tipo === 'categoria') {
      setNuevasCategorias((previas) => ({
        ...previas,
        [clave]: { nombre, color: formColor, icono },
      }))
      registrarCambio(creando.comercio, { categoria: clave, excluir: false })
    } else {
      setNuevosSubtipos((previos) => ({ ...previos, [clave]: { nombre, icono } }))
      registrarCambio(creando.comercio, { subtipo: clave, excluir: false })
    }
    setCreando(null)
  }

  async function guardar() {
    setEnviando(true)
    setMensaje(null)
    try {
      const respuesta = await fetch('/api/super/comercios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cambios, nuevasCategorias, nuevosSubtipos }),
      })
      const datos = await respuesta.json().catch(() => ({}))
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron guardar los cambios.')
      setCambios({})
      setNuevasCategorias({})
      setNuevosSubtipos({})
      const partes = []
      if (datos.guardados) partes.push(`${datos.guardados} correcciones`)
      if (datos.categoriasCreadas) partes.push(`${datos.categoriasCreadas} categorías nuevas`)
      if (datos.subtiposCreados) partes.push(`${datos.subtiposCreados} subcategorías nuevas`)
      setMensaje({
        tipo: 'ok',
        texto: `Commit hecho (${partes.join(', ')}). Se publicarán con el redeploy, en un par de minutos.`,
      })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setEnviando(false)
    }
  }

  const totalPendiente = totalCambios + totalNuevas

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif-dm text-xl text-tinta">Categorización de comercios</h2>
          <p className="mt-1 font-serif-spectral text-sm text-pardo">
            Corrige la categoría y subcategoría de las entradas que Google clasifica mal,
            créalas si no existen, o excluye locales del directorio. Al guardar se hace un
            commit y los cambios se publican con el redeploy (~2 min). Se conservan aunque se
            regenere el directorio.
          </p>
        </div>
        <button
          type="button"
          onClick={guardar}
          disabled={totalPendiente === 0 || enviando}
          className="gz-boton-tinta inline-flex shrink-0 items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MIcon name="save" className="text-[16px]" />
          {enviando ? 'Guardando…' : `Guardar ${totalPendiente || ''} ${totalPendiente === 1 ? 'cambio' : 'cambios'}`}
        </button>
      </div>

      {mensaje && (
        <p
          className={`flex items-start gap-2 border px-4 py-3 font-serif-spectral text-sm ${
            mensaje.tipo === 'ok'
              ? 'border-verde-bosque-borde bg-verde-salvia-claro text-verde-bosque'
              : 'border-terracota bg-terracota-fondo text-terracota'
          }`}
        >
          <MIcon name={mensaje.tipo === 'ok' ? 'check_circle' : 'error'} className="mt-0.5 text-[18px]" />
          <span>{mensaje.texto}</span>
        </p>
      )}

      {totalNuevas > 0 && (
        <p className="flex items-start gap-2 border border-filete bg-papel-calido px-4 py-3 font-serif-spectral text-sm text-tinta">
          <MIcon name="new_label" className="mt-0.5 text-[18px] text-ocre-profundo" />
          <span>
            Se crearán al guardar:{' '}
            {[
              ...Object.values(nuevasCategorias).map((d) => `categoría «${d.nombre}»`),
              ...Object.values(nuevosSubtipos).map((d) => `subcategoría «${d.nombre}»`),
            ].join(', ')}
            . Recuerda añadir después su foto en <code>public/img/comercios/</code>.
          </span>
        </p>
      )}

      {creando && (
        <div className="space-y-3 border border-tinta bg-papel-calido p-4">
          <p className="font-serif-dm text-base text-tinta">
            Nueva {creando.tipo === 'categoria' ? 'categoría' : 'subcategoría'} para «
            {creando.comercio.nombre}»
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
              Nombre
              <input
                type="text"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="p. ej. Ocio nocturno"
                className="gz-input w-56 py-2 text-sm normal-case tracking-normal"
                autoFocus
              />
            </label>
            {creando.tipo === 'categoria' && (
              <label className="flex flex-col gap-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Color
                <input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="h-9 w-16 cursor-pointer border border-tinta bg-papel p-1"
                />
              </label>
            )}
            <label className="flex flex-col gap-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
              Icono (opcional)
              <input
                type="text"
                value={formIcono}
                onChange={(e) => setFormIcono(e.target.value)}
                placeholder="storefront"
                className="gz-input w-40 py-2 text-sm normal-case tracking-normal"
              />
            </label>
            <button type="button" onClick={confirmarCreacion} className="gz-boton-tinta">
              Crear
            </button>
            <button type="button" onClick={() => setCreando(null)} className="gz-boton-borde">
              Cancelar
            </button>
          </div>
          <p className="font-serif-spectral text-xs text-pardo">
            El identificador se deriva del nombre ({formNombre.trim() ? `«${slugDe(formNombre)}»` : 'automático'}).
            El icono es un nombre de{' '}
            <a
              href="https://fonts.google.com/icons"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Material Symbols
            </a>
            .
          </p>
          {formError && (
            <p className="font-serif-spectral text-sm text-terracota">{formError}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MIcon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-mudo"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Busca por nombre, tipo de Google o dirección…"
            className="gz-input w-full pl-9"
          />
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta text-tinta">
          <input
            type="checkbox"
            checked={soloGenericos}
            onChange={(e) => setSoloGenericos(e.target.checked)}
            className="accent-terracota"
          />
          Solo sin subtipo claro
        </label>
      </div>

      <p className="gz-label text-mudo">
        {filtrados.length} {filtrados.length === 1 ? 'comercio' : 'comercios'}
        {filtrados.length > MAX_FILAS && ` (se muestran ${MAX_FILAS} — afina la búsqueda)`}
      </p>

      <div className="divide-y divide-filete border-t border-tinta">
        {visibles.map((c) => {
          const valor = valorActual(c)
          const editado = Boolean(cambios[c.id])
          const excluido = valor.excluir === true
          const conOverride = Boolean(overridesActuales[c.id])
          return (
            <div
              key={c.id}
              className={`flex flex-col gap-3 py-3 lg:flex-row lg:items-center ${excluido ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif-dm text-base leading-tight text-tinta">
                  {c.nombre}
                  {editado && <span className="ml-2 align-middle text-terracota">●</span>}
                </p>
                <p className="mt-0.5 truncate font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                  {c.tipoDisplay || 'Sin tipo de Google'} · {c.direccion || 'sin dirección'}
                  {conOverride && <span className="ml-2 text-ocre-profundo">· corregido antes</span>}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={excluido ? '' : valor.categoria}
                  disabled={excluido}
                  onChange={(e) => {
                    if (e.target.value === NUEVA) abrirCreacion('categoria', c)
                    else registrarCambio(c, { categoria: e.target.value, excluir: false })
                  }}
                  className="gz-input py-2 text-sm"
                  aria-label={`Categoría de ${c.nombre}`}
                >
                  {opcionesCategoria.map((cat) => (
                    <option key={cat.clave} value={cat.clave}>
                      {cat.nombre}
                    </option>
                  ))}
                  <option value={NUEVA}>+ Nueva categoría…</option>
                </select>

                <select
                  value={excluido ? '' : valor.subtipo}
                  disabled={excluido}
                  onChange={(e) => {
                    if (e.target.value === NUEVA) abrirCreacion('subtipo', c)
                    else registrarCambio(c, { subtipo: e.target.value, excluir: false })
                  }}
                  className="gz-input py-2 text-sm"
                  aria-label={`Subcategoría de ${c.nombre}`}
                >
                  {!SUBTIPO_INFO[valor.subtipo] && !nuevosSubtipos[valor.subtipo] && (
                    <option value={valor.subtipo}>{infoSubtipo(valor.subtipo).nombre}</option>
                  )}
                  {opcionesSubtipo.map((s) => (
                    <option key={s.clave} value={s.clave}>
                      {s.nombre}
                    </option>
                  ))}
                  <option value={NUEVA}>+ Nueva subcategoría…</option>
                </select>

                <button
                  type="button"
                  onClick={() => registrarCambio(c, { excluir: !excluido })}
                  className={`inline-flex items-center gap-1 border px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta transition-colors ${
                    excluido
                      ? 'border-terracota bg-terracota text-papel'
                      : 'border-filete text-pardo hover:border-terracota hover:text-terracota'
                  }`}
                  title={excluido ? 'Volver a incluir en el directorio' : 'Excluir del directorio'}
                >
                  <MIcon name={excluido ? 'undo' : 'visibility_off'} className="text-[14px]" />
                  {excluido ? 'Excluido' : 'Excluir'}
                </button>
              </div>
            </div>
          )
        })}

        {visibles.length === 0 && (
          <p className="border border-dashed border-filete-punteado p-8 text-center font-serif-spectral text-sm text-pardo">
            No hay comercios que coincidan con el filtro.
          </p>
        )}
      </div>
    </div>
  )
}
