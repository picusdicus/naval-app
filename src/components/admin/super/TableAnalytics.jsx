import { useState, useEffect } from 'react'
import MIcon from '../../MIcon.jsx'

export default function TableAnalytics({ umamiSummary }) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarAnalytics()
  }, [])

  const cargarAnalytics = async () => {
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/api/super/analytics')
      const respuesta = await res.json()
      if (!res.ok) throw new Error(respuesta.error || 'Error al cargar')
      setDatos(respuesta.analytics || null)
    } catch (err) {
      setError(err.message)
      setDatos(null)
    } finally {
      setCargando(false)
    }
  }

  // Calculate visits from Umami summary if available
  const visitasUltimos30Dias = umamiSummary?.visits?.value ?? datos?.resumen?.visitasUltimos30Dias ?? 0

  if (cargando) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 p-3">
        <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-error" />
        <p className="text-sm font-medium text-error">{error}</p>
      </div>
    )
  }

  if (!datos) return null

  const { resumen, visitasPorSeccion, eventosPorOrganizacion, preguntasFrequentes, comerciosBuscados } = datos

  return (
    <div className="space-y-8">
      {/* Resumen general */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-on-surface">Resumen general</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-surface-container-high p-4">
            <div className="text-sm text-on-surface/70">Organizaciones activas</div>
            <div className="text-3xl font-bold text-primary">{resumen.organizacionesActivas}</div>
            <div className="text-xs text-on-surface/50">de {resumen.totalOrganizaciones}</div>
          </div>
          <div className="rounded-lg bg-surface-container-high p-4">
            <div className="text-sm text-on-surface/70">Eventos publicados</div>
            <div className="text-3xl font-bold text-primary">{resumen.eventosPublicados}</div>
            <div className="text-xs text-on-surface/50">{resumen.totalEventos} total</div>
          </div>
          <div className="rounded-lg bg-surface-container-high p-4">
            <div className="text-sm text-on-surface/70">Usuarios registrados</div>
            <div className="text-3xl font-bold text-primary">{resumen.totalUsuarios}</div>
            <div className="text-xs text-on-surface/50">
              {resumen.admins} admin, {resumen.editores} editor
            </div>
          </div>
          <div className="rounded-lg bg-surface-container-high p-4">
            <div className="text-sm text-on-surface/70">Visitas últimos 30 días</div>
            <div className="text-3xl font-bold text-primary">
              {visitasUltimos30Dias.toLocaleString('es-ES')}
            </div>
          </div>
        </div>
      </div>

      {/* Visitas por sección */}
      {visitasPorSeccion.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-bold text-on-surface">Visitas por sección (últimos 30 días)</h2>
          <div className="space-y-2 rounded-lg border border-outline-variant/30 p-4">
            {visitasPorSeccion.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="min-w-[120px] text-sm font-medium text-on-surface/70">
                  {item.seccion || 'Sin clasificar'}
                </div>
                <div className="flex-1">
                  <div className="flex h-6 items-center rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-primary to-primary/70 h-full"
                      style={{
                        width: `${Math.min(100, (item.total / (visitasPorSeccion[0]?.total || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="min-w-[60px] text-right text-sm font-semibold text-on-surface">
                  {item.total}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Eventos por organización */}
      {eventosPorOrganizacion.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-bold text-on-surface">Eventos por organización</h2>
          <div className="overflow-x-auto rounded-lg border border-outline-variant/30">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-high">
                <tr className="border-b border-outline-variant/30">
                  <th className="px-4 py-3 text-left font-semibold">Organización</th>
                  <th className="px-4 py-3 text-center font-semibold">Eventos publicados</th>
                </tr>
              </thead>
              <tbody>
                {eventosPorOrganizacion.map((item) => (
                  <tr key={item.organizacionId} className="border-b border-outline-variant/30 hover:bg-surface-container-high/50">
                    <td className="px-4 py-3 font-medium">{item.organizacionNombre}</td>
                    <td className="px-4 py-3 text-center text-primary font-semibold">{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preguntas frecuentes */}
      {preguntasFrequentes.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-bold text-on-surface">Preguntas más frecuentes al asistente</h2>
          <div className="space-y-2 rounded-lg border border-outline-variant/30 p-4">
            {preguntasFrequentes.slice(0, 10).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-outline-variant/30 py-2 last:border-0">
                <div className="flex-1 text-sm text-on-surface/80 line-clamp-2">
                  {item.pregunta || 'Sin pregunta'}
                </div>
                <div className="ml-4 inline-block rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  {item.total}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comercios buscados */}
      {comerciosBuscados.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-bold text-on-surface">Comercios más buscados</h2>
          <div className="space-y-2 rounded-lg border border-outline-variant/30 p-4">
            {comerciosBuscados.slice(0, 10).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-outline-variant/30 py-2 last:border-0">
                <div className="flex-1 text-sm font-medium text-on-surface">
                  {item.comercio || 'Sin nombre'}
                </div>
                <div className="ml-4 inline-block rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  {item.total}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
