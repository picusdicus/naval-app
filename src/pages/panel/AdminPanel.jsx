import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MIcon from '../../components/MIcon.jsx'
import DialogoConfirmacion from '../../components/admin/DialogoConfirmacion.jsx'
import AnaliticasOrganizacion from '../../components/admin/AnaliticasOrganizacion.jsx'
import DestacaNegocio from '../../components/admin/DestacaNegocio.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import { CATEGORIAS_EVENTO } from '../../lib/eventos.js'
import { campanaFinalizada, diasParaCaducar, textoCaducidad } from '../../lib/destacados.js'
import { hoyISO } from '../../lib/fechas.js'

const ESTADOS = {
  publicado: { etiqueta: 'Publicado', clases: 'bg-secondary-container text-on-secondary-container' },
  borrador: { etiqueta: 'Borrador', clases: 'bg-surface-container-high text-on-surface-variant' },
  archivado: { etiqueta: 'Archivado', clases: 'bg-error-container text-on-error-container' },
}

function formatearFecha(iso) {
  if (!iso) return ''
  const [anio, mes, dia] = String(iso).slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(anio, mes - 1, dia))
}

function Estadistica({ icono, valor, etiqueta }) {
  // En móvil no caben icono y texto en la misma línea sin recortar la
  // etiqueta, así que se apilan; a partir de `sm` van en fila.
  return (
    <div className="nv-card flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-container sm:h-10 sm:w-10">
        <MIcon name={icono} className="text-[20px] text-on-primary" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-xl font-bold leading-tight text-on-surface">{valor}</p>
        <p className="text-xs text-on-surface/60">{etiqueta}</p>
      </div>
    </div>
  )
}

function FilaEvento({ evento, destacado, ocupado, onCambiarEstado, onEliminar, onDestacar, onRetirarDestacado }) {
  const estado = ESTADOS[evento.estado] ?? ESTADOS.borrador
  const horario = evento.horaFin ? `${evento.hora} – ${evento.horaFin}` : evento.hora
  const publicado = evento.estado === 'publicado'
  // Solo tiene sentido destacar lo que ya está en la agenda y aún no ha pasado.
  const destacable = publicado && evento.fecha >= hoyISO() && !destacado

  return (
    <li className="nv-card p-4 sm:p-5">
      <div className="flex gap-4">
        {evento.imagen && (
          <img
            src={evento.imagen}
            alt=""
            className="h-14 w-14 flex-shrink-0 rounded-lg object-cover sm:h-20 sm:w-20"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-semibold text-on-surface">{evento.titulo}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${estado.clases}`}>
              {estado.etiqueta}
            </span>
            {destacado?.estado === 'pendiente' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-container px-2.5 py-0.5 text-xs font-semibold text-on-tertiary-container">
                <MIcon name="hourglass_top" className="text-[14px]" />
                Destacado solicitado
              </span>
            )}
            {/* Activo con la campaña terminada: que la org no crea que sigue en vigor. */}
            {campanaFinalizada(destacado) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-semibold text-on-surface/60">
                <MIcon name="kid_star" className="text-[14px]" />
                Destacado finalizado
              </span>
            )}
            {destacado?.estado === 'activo' && !campanaFinalizada(destacado) && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  diasParaCaducar(destacado) !== null
                    ? 'bg-tertiary-container text-on-tertiary-container'
                    : 'bg-secondary-container text-on-secondary-container'
                }`}
              >
                <MIcon name="kid_star" className="text-[14px]" fill />
                {diasParaCaducar(destacado) !== null
                  ? `Destacado · ${textoCaducidad(diasParaCaducar(destacado))}`
                  : 'Destacado'}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface/70">
            <span className="inline-flex items-center gap-1">
              <MIcon name="calendar_today" className="text-[16px]" />
              {formatearFecha(evento.fecha)}
              {horario ? ` · ${horario}` : ''}
            </span>
            {evento.lugar && (
              <span className="inline-flex items-center gap-1">
                <MIcon name="place" className="text-[16px]" />
                {evento.lugar}
              </span>
            )}
            {CATEGORIAS_EVENTO[evento.categoria] && (
              <span className="inline-flex items-center gap-1">
                <MIcon name="sell" className="text-[16px]" />
                {CATEGORIAS_EVENTO[evento.categoria].nombre}
              </span>
            )}
            {evento.entradasUrl && (
              <span className="inline-flex items-center gap-1">
                <MIcon name="local_activity" className="text-[16px]" />
                {evento.precio || 'Con entradas'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Acciones: en móvil ocupan el ancho completo bajo los datos. */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-outline-variant/20 pt-3">
        <Link
          to={`/panel/eventos/${evento.id}/editar`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant/40 px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:flex-none"
        >
          <MIcon name="edit" className="text-[16px]" />
          Editar
        </Link>

        <button
          type="button"
          disabled={ocupado}
          onClick={() => onCambiarEstado(evento, publicado ? 'borrador' : 'publicado')}
          className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant/40 px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:enabled:bg-surface-container-high disabled:opacity-50 sm:flex-none"
        >
          <MIcon name={publicado ? 'visibility_off' : 'publish'} className="text-[16px]" />
          {publicado ? 'Pasar a borrador' : 'Publicar'}
        </button>

        {destacable && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onDestacar(evento)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant/40 px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:enabled:bg-surface-container-high disabled:opacity-50 sm:flex-none"
          >
            <MIcon name="star" className="text-[16px]" />
            Destacar
          </button>
        )}

        {destacado?.estado === 'pendiente' && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onRetirarDestacado(destacado)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant/40 px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:enabled:bg-surface-container-high disabled:opacity-50 sm:flex-none"
          >
            <MIcon name="star_half" className="text-[16px]" />
            Retirar solicitud
          </button>
        )}

        <button
          type="button"
          disabled={ocupado}
          onClick={() => onEliminar(evento)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-error/30 px-3 py-2 text-sm font-semibold text-error transition-colors hover:enabled:bg-error/10 disabled:opacity-50 sm:flex-none"
        >
          <MIcon name="delete" className="text-[16px]" />
          Eliminar
        </button>
      </div>
    </li>
  )
}

export default function AdminPanel() {
  const { usuario, cerrarSesion } = useAdminAuth()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [porEliminar, setPorEliminar] = useState(null)
  const [pestana, setPestana] = useState('eventos')

  // Estado de las solicitudes de destacado y el negocio vinculado (si lo hay).
  const [destacadosOrg, setDestacadosOrg] = useState([])
  const [comercioId, setComercioId] = useState(null)

  // Tras cada cambio se recarga la lista: las métricas salen del mismo
  // cálculo que hace Neon, sin llevar una cuenta paralela en el cliente.
  const cargar = useCallback(async () => {
    const [respuesta, respuestaDestacados] = await Promise.all([
      fetch('/api/admin/eventos'),
      fetch('/api/admin/destacados'),
    ])
    if (respuesta.status === 401) return cerrarSesion()

    const cuerpo = await respuesta.json().catch(() => ({}))
    if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudieron cargar los eventos.')
    setDatos(cuerpo)

    // Los destacados son complementarios: si fallan, el panel sigue operativo
    // (sin botón "Destacar"), no se rompe la gestión de eventos.
    const cuerpoDestacados = await respuestaDestacados.json().catch(() => ({}))
    if (respuestaDestacados.ok) {
      setDestacadosOrg(cuerpoDestacados.destacados ?? [])
      setComercioId(cuerpoDestacados.comercioId ?? null)
    }
  }, [cerrarSesion])

  useEffect(() => {
    let vigente = true

    cargar()
      .catch((err) => {
        if (vigente) setError(err.message)
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [cargar])

  const conRecarga = async (peticion) => {
    setOcupado(true)
    setError('')
    try {
      const respuesta = await peticion()
      if (respuesta.status === 401) return cerrarSesion()

      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => ({}))
        throw new Error(cuerpo.error || 'La acción no se pudo completar.')
      }
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const cambiarEstado = (evento, estado) =>
    conRecarga(() =>
      fetch(`/api/admin/eventos?id=${encodeURIComponent(evento.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
    )

  const confirmarBorrado = async () => {
    const evento = porEliminar
    await conRecarga(() =>
      fetch(`/api/admin/eventos?id=${encodeURIComponent(evento.id)}`, { method: 'DELETE' })
    )
    setPorEliminar(null)
  }

  const solicitarDestacadoEvento = (evento) =>
    conRecarga(() =>
      fetch('/api/admin/destacados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'evento', eventoId: evento.id }),
      })
    )

  const solicitarDestacadoComercio = (imagenUrl) =>
    conRecarga(() =>
      fetch('/api/admin/destacados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'comercio', imagenUrl }),
      })
    )

  const retirarSolicitud = (destacado) =>
    conRecarga(() =>
      fetch(`/api/admin/destacados?id=${encodeURIComponent(destacado.id)}`, { method: 'DELETE' })
    )

  // Una solicitud rechazada (cancelado) se trata como inexistente: la
  // organización simplemente vuelve a ver el botón "Destacar".
  const destacadoDeEvento = (evento) =>
    destacadosOrg.find(
      (d) => d.tipo === 'evento' && d.referenciaId === `bd-${evento.id}` && d.estado !== 'cancelado'
    ) ?? null

  const destacadoComercio =
    destacadosOrg.find((d) => d.tipo === 'comercio' && d.estado !== 'cancelado') ?? null

  const resumen = datos?.resumen
  const eventos = datos?.eventos ?? []

  return (
    <div className="min-h-screen bg-surface-container-low pb-16">
      <header className="border-b border-outline-variant/20 bg-surface-container-lowest">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-container">
            <MIcon name="admin_panel_settings" className="text-[20px] text-on-primary" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display font-bold leading-tight text-primary">
              {datos?.organizacion?.nombre ?? 'Panel de gestión'}
            </p>
            <p className="truncate text-xs text-on-surface/60">{usuario?.email}</p>
          </div>

          <button
            type="button"
            onClick={cerrarSesion}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-full border border-outline-variant/40 px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:px-4"
          >
            <MIcon name="logout" className="text-[18px]" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Pestañas: eventos (gestión) y analíticas (visitas propias en Neon). */}
        <div className="mb-6 flex gap-1 rounded-full bg-surface-container-high p-1 sm:w-fit">
          {[
            ['eventos', 'event', 'Mis eventos'],
            ['analiticas', 'monitoring', 'Mis analíticas'],
          ].map(([clave, icono, etiqueta]) => (
            <button
              key={clave}
              type="button"
              onClick={() => setPestana(clave)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
                pestana === clave
                  ? 'bg-primary text-on-primary shadow-card'
                  : 'text-on-surface/70 hover:text-on-surface'
              }`}
            >
              <MIcon name={icono} className="text-[18px]" />
              {etiqueta}
            </button>
          ))}
        </div>

        {pestana === 'analiticas' && <AnaliticasOrganizacion onNoAutenticado={cerrarSesion} />}

        <div className={pestana === 'eventos' ? '' : 'hidden'}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-on-surface">Tus eventos</h1>

          <Link
            to="/panel/eventos/nuevo"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-shadow hover:shadow-card-lg"
          >
            <MIcon name="add" className="text-[18px]" />
            Nuevo evento
          </Link>
        </div>

        {cargando && <p className="text-sm text-on-surface/60">Cargando eventos…</p>}

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 p-4"
          >
            <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-error" />
            <p className="text-sm font-medium text-error">{error}</p>
          </div>
        )}

        {resumen && (
          <>
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Estadistica icono="visibility" valor={resumen.publicados} etiqueta="Publicados" />
              <Estadistica icono="draft" valor={resumen.borradores} etiqueta="Borradores" />
              <Estadistica icono="upcoming" valor={resumen.proximos} etiqueta="Próximos" />
              <Estadistica icono="history" valor={resumen.pasados} etiqueta="Pasados" />
            </div>

            {comercioId && (
              <DestacaNegocio
                comercioId={comercioId}
                destacado={destacadoComercio}
                ocupado={ocupado}
                onSolicitar={solicitarDestacadoComercio}
                onRetirar={retirarSolicitud}
              />
            )}

            {eventos.length === 0 ? (
              <div className="nv-card flex flex-col items-center gap-3 px-6 py-12 text-center">
                <MIcon name="event_busy" className="text-[40px] text-on-surface/30" />
                <p className="font-display font-semibold text-on-surface">
                  Todavía no tienes eventos
                </p>
                <p className="max-w-sm text-sm text-on-surface/60">
                  Crea el primero: los borradores solo los ves tú, y los publicados aparecen en la
                  agenda del municipio.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {eventos.map((evento) => (
                  <FilaEvento
                    key={evento.id}
                    evento={evento}
                    destacado={destacadoDeEvento(evento)}
                    ocupado={ocupado}
                    onCambiarEstado={cambiarEstado}
                    onEliminar={setPorEliminar}
                    onDestacar={solicitarDestacadoEvento}
                    onRetirarDestacado={retirarSolicitud}
                  />
                ))}
              </ul>
            )}
          </>
        )}
        </div>
      </main>

      <DialogoConfirmacion
        abierto={Boolean(porEliminar)}
        titulo="¿Eliminar este evento?"
        mensaje={
          porEliminar
            ? `«${porEliminar.titulo}» se borrará definitivamente. Esta acción no se puede deshacer.`
            : ''
        }
        ocupado={ocupado}
        onConfirmar={confirmarBorrado}
        onCancelar={() => setPorEliminar(null)}
      />
    </div>
  )
}
