import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import MIcon from '../MIcon.jsx'
import { LISTA_CATEGORIAS_EVENTO } from '../../lib/eventos.js'
import { ORGANIZADORES_FIJOS } from '../../lib/temasPush.js'
import {
  soportaPush,
  esIOS,
  esPWAInstalada,
  prefsLocales,
  suscribir,
  desuscribir,
} from '../../lib/push.js'

const MODOS = [
  { id: 'todos', nombre: 'Todos los eventos', icono: 'notifications_active' },
  { id: 'categorias', nombre: 'Solo algunas categorías', icono: 'category' },
  { id: 'organizadores', nombre: 'Solo algunos organizadores', icono: 'groups' },
]

// Deduce el modo de la UI a partir de una lista de temas guardada.
function modoDeTemas(temas) {
  if (!temas || temas.includes('todos')) return 'todos'
  if (temas.some((t) => t.startsWith('org:'))) return 'organizadores'
  return 'categorias'
}

function Chip({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap px-3 py-2 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta transition-colors ${
        activo ? 'bg-tinta text-papel' : 'border border-tinta text-tinta hover:bg-papel-calido'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Diálogo de opt-in de avisos push: tres modos (todos / categorías /
 * organizadores). El permiso de notificaciones se pide al pulsar "Activar"
 * (gesto de usuario), nunca al cargar. En iOS sin la PWA instalada no se
 * intenta pedir permiso: Safari solo soporta Web Push dentro de la app
 * instalada, así que el diálogo lo explica y ofrece la instalación.
 */
export default function DialogoAvisos({ abierto, onCerrar }) {
  const dialogo = useRef(null)
  const [modo, setModo] = useState('todos')
  const [categorias, setCategorias] = useState([])
  const [organizadores, setOrganizadores] = useState([])
  const [orgsNeon, setOrgsNeon] = useState([])
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [activo, setActivo] = useState(false)

  // Lista semi-fija de organizadores: los fijos (Ayuntamiento, TYL TYL) más
  // las organizaciones activas de Neon, deduplicadas por slug. NO se deriva de
  // los eventos cargados: un organizador sin eventos hoy sigue siendo elegible.
  const listaOrganizadores = useMemo(() => {
    const porSlug = new Map(ORGANIZADORES_FIJOS.map((o) => [o.slug, o]))
    for (const o of orgsNeon) {
      if (o?.slug && !porSlug.has(o.slug)) porSlug.set(o.slug, o)
    }
    return [...porSlug.values()]
  }, [orgsNeon])

  useEffect(() => {
    const elemento = dialogo.current
    if (!elemento) return
    if (abierto && !elemento.open) {
      // Cada apertura re-pinta el estado actual desde localStorage (copia
      // local de la fila del servidor, solo para no consultarla en cada carga).
      const temas = prefsLocales()
      setActivo(Boolean(temas))
      setModo(modoDeTemas(temas))
      setCategorias((temas || []).filter((t) => t.startsWith('cat:')).map((t) => t.slice(4)))
      setOrganizadores((temas || []).filter((t) => t.startsWith('org:')).map((t) => t.slice(4)))
      setError('')
      elemento.showModal()
    }
    if (!abierto && elemento.open) elemento.close()
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    fetch('/api/organizadores')
      .then((r) => (r.ok ? r.json() : { organizadores: [] }))
      .then((datos) => setOrgsNeon(datos.organizadores ?? []))
      .catch(() => setOrgsNeon([]))
  }, [abierto])

  const alternar = (lista, setLista, valor) =>
    setLista(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor])

  const temasElegidos = useMemo(() => {
    if (modo === 'todos') return ['todos']
    if (modo === 'categorias') return categorias.map((c) => `cat:${c}`)
    return organizadores.map((o) => `org:${o}`)
  }, [modo, categorias, organizadores])

  const iosSinInstalar = esIOS() && !esPWAInstalada()
  const sinSoporte = !soportaPush() && !iosSinInstalar

  // Resumen legible de a qué está suscrito ahora (opción "ver mis preferencias").
  const resumenActual = useMemo(() => {
    if (!activo) return ''
    if (modo === 'todos') return 'Todos los eventos'
    if (modo === 'categorias') {
      const nombres = categorias
        .map((id) => LISTA_CATEGORIAS_EVENTO.find((c) => c.id === id)?.nombre)
        .filter(Boolean)
      return nombres.length ? nombres.join(', ') : 'Ninguna categoría'
    }
    const nombres = organizadores
      .map((slug) => listaOrganizadores.find((o) => o.slug === slug)?.nombre || slug)
      .filter(Boolean)
    return nombres.length ? nombres.join(', ') : 'Ningún organizador'
  }, [activo, modo, categorias, organizadores, listaOrganizadores])

  const activar = async () => {
    setOcupado(true)
    setError('')
    try {
      await suscribir(temasElegidos)
      setActivo(true)
      onCerrar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const desactivar = async () => {
    setOcupado(true)
    setError('')
    try {
      await desuscribir()
      setActivo(false)
      onCerrar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <dialog
      ref={dialogo}
      onCancel={(e) => {
        e.preventDefault()
        if (!ocupado) onCerrar()
      }}
      className="w-full max-w-md border border-tinta bg-papel p-0 shadow-cartel backdrop:bg-tinta/40"
    >
      <div className="p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-tinta">
          <MIcon name="notifications" className="text-[24px] text-oro" />
        </div>

        <h2 className="font-serif-dm text-2xl text-tinta">Avisos de la agenda</h2>
        <p className="mt-1 font-serif-spectral text-sm text-pardo">
          Te avisamos en este dispositivo cuando haya eventos nuevos. Sin registro: elige de qué
          quieres enterarte.
        </p>

        {/* Ver mis preferencias: resumen de a qué está suscrito ahora este aparato. */}
        {resumenActual && !iosSinInstalar && !sinSoporte && (
          <div className="mt-4 flex items-start gap-2 border-l-2 border-verde bg-papel-calido px-4 py-3 font-serif-spectral text-sm text-tinta">
            <MIcon name="check_circle" className="mt-0.5 text-[18px] text-verde" fill />
            <span>
              Ahora recibes: <span className="font-semibold">{resumenActual}</span>
            </span>
          </div>
        )}

        {iosSinInstalar ? (
          <div className="mt-4 border border-filete bg-papel-calido p-4 font-serif-spectral text-sm text-tinta">
            <p className="font-semibold">Primero instala la app</p>
            <p className="mt-1">
              En iPhone y iPad los avisos solo funcionan con la app en la pantalla de inicio: abre
              el menú compartir de Safari, elige{' '}
              <span className="font-semibold">«Añadir a pantalla de inicio»</span> y vuelve a
              activar los avisos desde la app instalada.
            </p>
          </div>
        ) : sinSoporte ? (
          <div className="mt-4 border border-filete bg-papel-calido p-4 font-serif-spectral text-sm text-tinta">
            Este navegador no soporta notificaciones push.
          </div>
        ) : (
          <>
            <div className="mt-4 border border-filete bg-papel-calido p-4 font-serif-spectral text-sm text-tinta-apagada">
              <p className="mb-2">
                Guardamos un identificador anónimo de tu dispositivo y tu preferencia de temas
                para poder enviarte avisos. No vinculamos esto a tu identidad.
              </p>
              <p>
                Consulta nuestra{' '}
                <Link to="/privacidad" className="font-semibold text-terracota hover:underline">
                  Política de privacidad
                </Link>{' '}
                para más detalles.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {MODOS.map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-3 border px-4 py-3 transition-colors ${
                    modo === m.id ? 'border-tinta bg-papel-calido' : 'border-filete hover:bg-papel-calido/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="modo-avisos"
                    checked={modo === m.id}
                    onChange={() => setModo(m.id)}
                    className="accent-terracota"
                  />
                  <MIcon name={m.icono} className="text-[20px] text-pardo" />
                  <span className="font-serif-spectral text-sm font-semibold text-tinta">{m.nombre}</span>
                </label>
              ))}
            </div>

            {modo === 'categorias' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {LISTA_CATEGORIAS_EVENTO.map((cat) => (
                  <Chip
                    key={cat.id}
                    activo={categorias.includes(cat.id)}
                    onClick={() => alternar(categorias, setCategorias, cat.id)}
                  >
                    {cat.nombre}
                  </Chip>
                ))}
              </div>
            )}

            {modo === 'organizadores' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {listaOrganizadores.map((org) => (
                  <Chip
                    key={org.slug}
                    activo={organizadores.includes(org.slug)}
                    onClick={() => alternar(organizadores, setOrganizadores, org.slug)}
                  >
                    {org.nombre}
                  </Chip>
                ))}
              </div>
            )}

            {error && <p className="mt-3 font-serif-spectral text-sm font-semibold text-terracota">{error}</p>}
          </>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          {activo && !iosSinInstalar && !sinSoporte && (
            <button
              type="button"
              onClick={desactivar}
              disabled={ocupado}
              className="gz-boton-peligro disabled:opacity-50 sm:mr-auto"
            >
              Desactivar avisos
            </button>
          )}
          <button
            type="button"
            onClick={onCerrar}
            disabled={ocupado}
            className="gz-boton-borde hover:bg-papel-calido disabled:opacity-50"
          >
            Cerrar
          </button>
          {!iosSinInstalar && !sinSoporte && (
            <button
              type="button"
              onClick={activar}
              disabled={ocupado || temasElegidos.length === 0}
              className="gz-boton-tinta disabled:opacity-50"
            >
              {ocupado ? 'Activando…' : activo ? 'Guardar cambios' : 'Activar avisos'}
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}
