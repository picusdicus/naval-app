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
      className={`nv-chip whitespace-nowrap transition-all ${
        activo
          ? 'bg-primary text-on-primary shadow-md'
          : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
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
      className="w-full max-w-md rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-0 shadow-card-lg backdrop:bg-black/40"
    >
      <div className="p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-container">
          <MIcon name="notifications" className="text-[24px] text-on-primary-container" />
        </div>

        <h2 className="font-display text-lg font-bold text-on-surface">Avisos de la agenda</h2>
        <p className="mt-1 text-sm text-on-surface/70">
          Te avisamos en este dispositivo cuando haya eventos nuevos. Sin registro: elige de qué
          quieres enterarte.
        </p>

        {/* Ver mis preferencias: resumen de a qué está suscrito ahora este aparato. */}
        {resumenActual && !iosSinInstalar && !sinSoporte && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary-container/30 px-4 py-3 text-sm text-on-surface">
            <MIcon name="check_circle" className="mt-0.5 text-[18px] text-primary" fill />
            <span>
              Ahora recibes: <span className="font-semibold">{resumenActual}</span>
            </span>
          </div>
        )}

        {iosSinInstalar ? (
          <div className="mt-4 rounded-lg bg-secondary-container/60 p-4 text-sm text-on-secondary-container">
            <p className="font-semibold">Primero instala la app</p>
            <p className="mt-1">
              En iPhone y iPad los avisos solo funcionan con la app en la pantalla de inicio: abre
              el menú compartir de Safari, elige{' '}
              <span className="font-semibold">«Añadir a pantalla de inicio»</span> y vuelve a
              activar los avisos desde la app instalada.
            </p>
          </div>
        ) : sinSoporte ? (
          <div className="mt-4 rounded-lg bg-secondary-container/60 p-4 text-sm text-on-secondary-container">
            Este navegador no soporta notificaciones push.
          </div>
        ) : (
          <>
            <div className="mt-4 rounded-lg bg-primary-container/20 p-4 text-sm text-on-surface">
              <p className="mb-2">
                Guardamos un identificador anónimo de tu dispositivo y tu preferencia de temas
                para poder enviarte avisos. No vinculamos esto a tu identidad.
              </p>
              <p>
                Consulta nuestra{' '}
                <Link to="/privacidad" className="text-primary font-semibold hover:underline">
                  Política de privacidad
                </Link>{' '}
                para más detalles.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {MODOS.map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                    modo === m.id
                      ? 'border-primary bg-primary-container/40'
                      : 'border-outline-variant/30 hover:bg-surface-container-high'
                  }`}
                >
                  <input
                    type="radio"
                    name="modo-avisos"
                    checked={modo === m.id}
                    onChange={() => setModo(m.id)}
                    className="accent-primary"
                  />
                  <MIcon name={m.icono} className="text-[20px] text-on-surface-variant" />
                  <span className="text-sm font-semibold text-on-surface">{m.nombre}</span>
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

            {error && <p className="mt-3 text-sm font-semibold text-error">{error}</p>}
          </>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          {activo && !iosSinInstalar && !sinSoporte && (
            <button
              type="button"
              onClick={desactivar}
              disabled={ocupado}
              className="rounded-lg border border-outline-variant/40 px-5 py-2.5 text-sm font-semibold text-error transition-colors hover:enabled:bg-surface-container-high disabled:opacity-50 sm:mr-auto"
            >
              Desactivar avisos
            </button>
          )}
          <button
            type="button"
            onClick={onCerrar}
            disabled={ocupado}
            className="rounded-lg border border-outline-variant/40 px-5 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:enabled:bg-surface-container-high disabled:opacity-50"
          >
            Cerrar
          </button>
          {!iosSinInstalar && !sinSoporte && (
            <button
              type="button"
              onClick={activar}
              disabled={ocupado || temasElegidos.length === 0}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:enabled:opacity-90 disabled:opacity-50"
            >
              {ocupado ? 'Activando…' : activo ? 'Guardar cambios' : 'Activar avisos'}
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}
