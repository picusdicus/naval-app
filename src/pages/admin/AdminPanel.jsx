import { useEffect, useState } from 'react'
import MIcon from '../../components/MIcon.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'

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

function FilaEvento({ evento }) {
  const estado = ESTADOS[evento.estado] ?? ESTADOS.borrador

  return (
    <li className="nv-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display font-semibold text-on-surface">{evento.titulo}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${estado.clases}`}>
          {estado.etiqueta}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface/70">
        <span className="inline-flex items-center gap-1">
          <MIcon name="calendar_today" className="text-[16px]" />
          {formatearFecha(evento.fecha)}
          {evento.hora ? ` · ${evento.hora}` : ''}
        </span>
        {evento.lugar && (
          <span className="inline-flex items-center gap-1">
            <MIcon name="place" className="text-[16px]" />
            {evento.lugar}
          </span>
        )}
      </div>
    </li>
  )
}

export default function AdminPanel() {
  const { usuario, cerrarSesion } = useAdminAuth()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true

    fetch('/api/admin/eventos')
      .then(async (r) => {
        // La cookie caducó mientras el panel estaba abierto: al limpiar el
        // usuario, RutaProtegida redirige sola al login.
        if (r.status === 401) return cerrarSesion()

        const cuerpo = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(cuerpo.error || 'No se pudieron cargar los eventos.')
        if (vigente) setDatos(cuerpo)
      })
      .catch((err) => {
        if (vigente) setError(err.message)
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [cerrarSesion])

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
        <h1 className="mb-4 font-display text-2xl font-bold text-on-surface">Tus eventos</h1>

        {cargando && <p className="text-sm text-on-surface/60">Cargando eventos…</p>}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 p-4"
          >
            <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-error" />
            <p className="text-sm font-medium text-error">{error}</p>
          </div>
        )}

        {resumen && (
          <>
            <div className="mb-8 grid grid-cols-3 gap-3">
              <Estadistica icono="event" valor={resumen.total} etiqueta="En total" />
              <Estadistica icono="upcoming" valor={resumen.proximos} etiqueta="Próximos" />
              <Estadistica icono="history" valor={resumen.pasados} etiqueta="Pasados" />
            </div>

            {eventos.length === 0 ? (
              <div className="nv-card flex flex-col items-center gap-3 px-6 py-12 text-center">
                <MIcon name="event_busy" className="text-[40px] text-on-surface/30" />
                <p className="font-display font-semibold text-on-surface">
                  Todavía no tienes eventos
                </p>
                <p className="max-w-sm text-sm text-on-surface/60">
                  Aquí aparecerán los eventos que publique {datos?.organizacion?.nombre} en la
                  agenda del municipio.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {eventos.map((evento) => (
                  <FilaEvento key={evento.id} evento={evento} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  )
}
