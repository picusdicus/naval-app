// Pestaña "Mis analíticas" del panel de organización (/panel).
//
// Lee GET /api/admin/eventos?accion=analytics — visitas propias registradas en
// Neon (tabla analytics, tipo 'visita_evento'), siempre acotadas a la
// organización de la sesión. No toca Umami: eso es del superadmin.
//
// Reutiliza StatCard, Sparkline y RankBar de UmamiStats.jsx tal cual.
import { useEffect, useState } from 'react'
import MIcon from '../MIcon.jsx'
import { StatCard, Sparkline, RankBar } from './UmamiStats.jsx'

function fechaCorta(iso) {
  if (!iso) return ''
  const [anio, mes, dia] = String(iso).slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(anio, mes - 1, dia))
}

export default function AnaliticasOrganizacion({ onNoAutenticado }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true

    fetch('/api/admin/eventos?accion=analytics')
      .then(async (respuesta) => {
        if (respuesta.status === 401) return onNoAutenticado?.()
        const cuerpo = await respuesta.json().catch(() => ({}))
        if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudieron cargar las analíticas.')
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
  }, [onNoAutenticado])

  if (cargando) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-surface-container-high" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 p-4"
      >
        <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-error" />
        <p className="text-sm font-medium text-error">{error}</p>
      </div>
    )
  }

  const ranking = datos?.rankingEventos ?? []
  const serie = datos?.serieDiaria ?? []
  const totalVisitas = datos?.totalVisitas ?? 0

  // Sin eventos no hay nada que medir: invitamos a crear el primero.
  if (ranking.length === 0) {
    return (
      <div className="nv-card flex flex-col items-center gap-3 px-6 py-12 text-center">
        <MIcon name="monitoring" className="text-[40px] text-on-surface/30" />
        <p className="font-display font-semibold text-on-surface">
          Aún no hay nada que medir
        </p>
        <p className="max-w-sm text-sm text-on-surface/60">
          Cuando publiques tu primer evento, aquí verás cuántos vecinos visitan su página y qué
          eventos despiertan más interés.
        </p>
      </div>
    )
  }

  const totalRanking = ranking.reduce((suma, e) => suma + e.visitas, 0)
  const puntosSerie = serie.map((d) => ({ x: d.dia, y: d.visitas }))
  const eventoTop = ranking[0]

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon="👀"
          label="Visitas a tus eventos"
          value={totalVisitas.toLocaleString('es-ES')}
          sub="en los últimos 30 días"
        />
        <StatCard
          icon="🎭"
          label="Eventos con página"
          value={ranking.length.toLocaleString('es-ES')}
          sub="publicados y borradores"
        />
        <StatCard
          icon="⭐"
          label="El que más interesa"
          value={eventoTop.visitas > 0 ? eventoTop.titulo : '—'}
          sub={eventoTop.visitas > 0 ? `${eventoTop.visitas.toLocaleString('es-ES')} visitas` : 'todavía sin visitas'}
        />
      </div>

      {totalVisitas === 0 ? (
        <div className="nv-card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <MIcon name="hourglass_empty" className="text-[40px] text-on-surface/30" />
          <p className="font-display font-semibold text-on-surface">
            Todavía no hay visitas registradas
          </p>
          <p className="max-w-sm text-sm text-on-surface/60">
            En cuanto los vecinos empiecen a abrir las páginas de tus eventos, verás aquí el total
            de visitas y qué evento recibe más atención. Comparte el enlace de tus eventos para
            darles un empujón.
          </p>
        </div>
      ) : (
        <>
          {/* Serie diaria (14 días) */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
              Visitas por día · últimos 14 días
            </p>
            <Sparkline data={puntosSerie} height={56} />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{fechaCorta(puntosSerie[0]?.x)}</span>
              <span>{fechaCorta(puntosSerie[puntosSerie.length - 1]?.x)}</span>
            </div>
          </div>

          {/* Comparativa entre eventos */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
              Tus eventos más visitados · últimos 30 días
            </p>
            <div className="space-y-2.5">
              {ranking.map((evento, i) => (
                <RankBar
                  key={evento.id}
                  rank={i + 1}
                  label={`${evento.titulo} · ${fechaCorta(evento.fecha)}`}
                  value={evento.visitas}
                  total={totalRanking}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
