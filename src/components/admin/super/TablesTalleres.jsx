import { useEffect, useMemo, useState } from 'react'
import { CATEGORIAS_TALLER, nombreCategoriaTaller, textoTurno } from '../../../lib/talleres.js'
import { hoyISO, sumarDias } from '../../../lib/fechas.js'
import FormularioTaller from './FormularioTaller.jsx'
import DialogoImportarTalleres from './DialogoImportarTalleres.jsx'
import MIcon from '../../MIcon.jsx'

// Tab Talleres de /admin: listado, alta, edición, publicación y borrado de los
// talleres municipales, más el destacado con un clic.
//
//   · Publicar / despublicar — PATCH /api/super/talleres?id= (solo el estado)
//   · Editar                 — abre el formulario con PUT ?id=
//   · Borrar                 — DELETE ?id= (los turnos caen en cascada)
//   · Destacar               — crea una fila en `destacados` (tipo 'taller')
//     con la misma duración por defecto que un evento destacado desde su tab.

const DIAS_DESTACADO = 30

export default function TablesTalleres() {
  const [talleres, setTalleres] = useState([])
  const [destacados, setDestacados] = useState([])
  const [resumen, setResumen] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(null)
  const [ocupadoId, setOcupadoId] = useState(null)
  const [formulario, setFormulario] = useState(null) // null | 'nuevo' | taller
  const [importando, setImportando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  // Cola de revisión: lo importado de un PDF nace en borrador y hay que poder
  // aislarlo del catálogo ya publicado. Filtra en cliente sobre la lista que el
  // GET ya devuelve entera — no hace falta endpoint nuevo.
  const [estadoFiltro, setEstadoFiltro] = useState('todos')

  async function cargar() {
    setCargando(true)
    try {
      const [resTalleres, resDestacados] = await Promise.all([
        fetch('/api/super/talleres').then((r) => (r.ok ? r.json() : { talleres: [] })),
        fetch('/api/super/destacados')
          .then((r) => (r.ok ? r.json() : { destacados: [] }))
          .catch(() => ({ destacados: [] })),
      ])
      setTalleres(resTalleres.talleres || [])
      setResumen(resTalleres.resumen || null)
      setDestacados((resDestacados.destacados || []).filter((d) => d.tipo === 'taller'))
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudieron cargar los talleres.' })
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const destacadoDe = (taller) => destacados.find((d) => d.referenciaId === taller.id)

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return talleres.filter((t) => {
      if (estadoFiltro !== 'todos' && t.estado !== estadoFiltro) return false
      if (!q) return true
      return (
        t.nombre.toLowerCase().includes(q) ||
        nombreCategoriaTaller(t.categoria).toLowerCase().includes(q) ||
        (t.lugar || '').toLowerCase().includes(q)
      )
    })
  }, [talleres, busqueda, estadoFiltro])

  // Curso que se propone al importar: el del taller más reciente del catálogo.
  // Se deriva de los datos y no de la fecha a propósito — quien importa en
  // junio el folleto del curso siguiente lo corrige en el campo.
  const cursoSugerido = useMemo(
    () => talleres.map((t) => t.curso).filter(Boolean).sort().pop() || '',
    [talleres],
  )

  async function cambiarEstado(taller, estado) {
    setOcupadoId(taller.id)
    setMensaje(null)
    try {
      const res = await fetch(`/api/super/talleres?id=${taller.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      const datos = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(datos.error || 'No se pudo cambiar el estado.')
      setTalleres((previos) => previos.map((t) => (t.id === taller.id ? datos.taller : t)))
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  async function borrar(taller) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`¿Borrar «${taller.nombre}» y todos sus turnos?`)) return
    setOcupadoId(taller.id)
    setMensaje(null)
    try {
      const res = await fetch(`/api/super/talleres?id=${taller.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const datos = await res.json().catch(() => ({}))
        throw new Error(datos.error || 'No se pudo borrar el taller.')
      }
      setTalleres((previos) => previos.filter((t) => t.id !== taller.id))
      setMensaje({ tipo: 'ok', texto: `«${taller.nombre}» borrado.` })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  async function destacar(taller) {
    setOcupadoId(taller.id)
    setMensaje(null)
    try {
      const inicio = hoyISO()
      const res = await fetch('/api/super/destacados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'taller',
          referenciaId: taller.id,
          orden: 0,
          fechaInicio: inicio,
          fechaFin: sumarDias(inicio, DIAS_DESTACADO - 1),
          estado: 'activo',
        }),
      })
      const datos = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(datos.error || 'No se pudo destacar el taller.')
      setDestacados((previos) => [
        ...previos.filter((d) => d.id !== datos.destacado.id),
        datos.destacado,
      ])
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  async function quitarDestacado(taller) {
    const destacado = destacadoDe(taller)
    if (!destacado) return
    setOcupadoId(taller.id)
    setMensaje(null)
    try {
      const res = await fetch(`/api/super/destacados?id=${destacado.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const datos = await res.json().catch(() => ({}))
        throw new Error(datos.error || 'No se pudo quitar el destacado.')
      }
      setDestacados((previos) => previos.filter((d) => d.id !== destacado.id))
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  if (importando) {
    return (
      <DialogoImportarTalleres
        cursoSugerido={cursoSugerido}
        onImportado={() => cargar()}
        onCerrar={() => {
          setImportando(false)
          // Tras importar, se enseña justo lo que hay que revisar.
          setEstadoFiltro('borrador')
        }}
      />
    )
  }

  if (formulario) {
    return (
      <FormularioTaller
        taller={formulario === 'nuevo' ? null : formulario}
        onCancelar={() => setFormulario(null)}
        onGuardado={(taller) => {
          setFormulario(null)
          setMensaje({ tipo: 'ok', texto: `«${taller.nombre}» guardado.` })
          cargar()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif-dm text-xl text-tinta">Talleres</h2>
          {resumen && (
            <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
              {resumen.total} en total · {resumen.publicados} publicados · {resumen.borradores}{' '}
              borradores
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setImportando(true)} className="gz-boton-borde">
            <MIcon name="upload_file" className="mr-1 text-[16px]" />
            Importar PDF
          </button>
          <button type="button" onClick={() => setFormulario('nuevo')} className="gz-boton-tinta">
            <MIcon name="add" className="mr-1 text-[16px]" />
            Crear taller
          </button>
        </div>
      </div>

      {mensaje && (
        <p
          className={`flex items-center gap-2 border p-2.5 font-serif-spectral text-sm ${
            mensaje.tipo === 'error'
              ? 'border-terracota bg-terracota-fondo text-terracota'
              : 'border-filete bg-papel-calido text-tinta'
          }`}
        >
          <MIcon name={mensaje.tipo === 'error' ? 'error' : 'check_circle'} className="text-[16px]" />
          {mensaje.texto}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          ['todos', 'Todos', resumen?.total],
          ['borrador', 'Borradores', resumen?.borradores],
          ['publicado', 'Publicados', resumen?.publicados],
          ['archivado', 'Archivados', resumen?.archivados],
        ].map(([valor, texto, n]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setEstadoFiltro(valor)}
            aria-pressed={estadoFiltro === valor}
            className={`border px-3 py-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta transition-colors ${
              estadoFiltro === valor
                ? 'border-tinta bg-tinta text-papel'
                : 'border-filete bg-papel text-pardo hover:border-tinta'
            }`}
          >
            {texto}
            {typeof n === 'number' && <span className="ml-1.5 opacity-70">{n}</span>}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, categoría o lugar…"
        aria-label="Buscar talleres"
        className="gz-input w-full"
      />

      {cargando && (
        <p className="py-8 text-center font-mono-ibm text-xs uppercase tracking-etiqueta text-mudo">
          Cargando…
        </p>
      )}

      {!cargando && visibles.length === 0 && (
        <p className="py-8 text-center font-serif-spectral text-sm text-mudo">
          {talleres.length === 0 ? 'Todavía no hay talleres.' : 'Ningún taller coincide.'}
        </p>
      )}

      <ul className="flex flex-col divide-y divide-filete border-y border-filete">
        {visibles.map((taller) => {
          const destacado = destacadoDe(taller)
          const ocupado = ocupadoId === taller.id
          const color = CATEGORIAS_TALLER[taller.categoria]?.color || '#b0472f'
          return (
            <li key={taller.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-serif-dm text-base text-tinta">{taller.nombre}</span>
                  {taller.estado !== 'publicado' && (
                    <span className="border border-pardo px-1.5 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-pardo">
                      {taller.estado}
                    </span>
                  )}
                  {destacado && (
                    <span className="bg-oro px-1.5 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-tinta">
                      Destacado
                    </span>
                  )}
                </div>
                <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
                  {nombreCategoriaTaller(taller.categoria)}
                  {taller.lugar && ` · ${taller.lugar}`}
                  {taller.precio && ` · ${taller.precio}`}
                  {` · ${taller.turnos?.length || 0} ${
                    taller.turnos?.length === 1 ? 'turno' : 'turnos'
                  }`}
                </p>
                {taller.turnos?.length > 0 && (
                  <ul className="mt-1 font-serif-spectral text-xs text-pardo">
                    {taller.turnos.map((t, i) => (
                      <li key={t.id || i}>{textoTurno(t)}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-shrink-0 flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFormulario(taller)}
                  disabled={ocupado}
                  className="px-2 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta hover:text-terracota disabled:opacity-40"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    cambiarEstado(taller, taller.estado === 'publicado' ? 'borrador' : 'publicado')
                  }
                  disabled={ocupado}
                  className="px-2 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta hover:text-terracota disabled:opacity-40"
                >
                  {taller.estado === 'publicado' ? 'Despublicar' : 'Publicar'}
                </button>
                <button
                  type="button"
                  onClick={() => (destacado ? quitarDestacado(taller) : destacar(taller))}
                  disabled={ocupado || taller.estado !== 'publicado'}
                  title={
                    taller.estado !== 'publicado'
                      ? 'Publica el taller antes de destacarlo'
                      : destacado
                        ? 'Quitar el destacado'
                        : 'Destacar este taller'
                  }
                  className="px-2 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta hover:text-terracota disabled:opacity-40"
                >
                  {destacado ? 'Quitar destacado' : 'Destacar'}
                </button>
                <button
                  type="button"
                  onClick={() => borrar(taller)}
                  disabled={ocupado}
                  className="px-2 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota hover:text-tinta disabled:opacity-40"
                >
                  Borrar
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
