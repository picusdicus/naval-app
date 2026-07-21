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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-filete border-t-terracota" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 border border-terracota/30 bg-terracota-fondo p-3">
        <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-terracota" />
        <p className="font-serif-spectral text-sm font-medium text-terracota">{error}</p>
      </div>
    )
  }

  if (!datos) return null

  const { resumen, visitasPorSeccion, eventosPorOrganizacion, preguntasFrequentes, comerciosBuscados } = datos

  return (
    <div className="space-y-8">
      {/* Resumen general */}
      <div>
        <h2 className="mb-4 font-serif-dm text-2xl text-tinta">Resumen general</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-papel-calido p-4">
            <div className="font-serif-spectral text-sm text-pardo">Organizaciones activas</div>
            <div className="font-serif-dm text-4xl leading-none text-terracota">{resumen.organizacionesActivas}</div>
            <div className="font-mono-ibm text-[10px] text-mudo">de {resumen.totalOrganizaciones}</div>
          </div>
          <div className="bg-papel-calido p-4">
            <div className="font-serif-spectral text-sm text-pardo">Eventos publicados</div>
            <div className="font-serif-dm text-4xl leading-none text-terracota">{resumen.eventosPublicados}</div>
            <div className="font-mono-ibm text-[10px] text-mudo">{resumen.totalEventos} total</div>
          </div>
          <div className="bg-papel-calido p-4">
            <div className="font-serif-spectral text-sm text-pardo">Usuarios registrados</div>
            <div className="font-serif-dm text-4xl leading-none text-terracota">{resumen.totalUsuarios}</div>
            <div className="font-mono-ibm text-[10px] text-mudo">
              {resumen.admins} admin, {resumen.editores} editor
            </div>
          </div>
          <div className="bg-papel-calido p-4">
            <div className="font-serif-spectral text-sm text-pardo">Visitas últimos 30 días</div>
            <div className="font-serif-dm text-4xl leading-none text-terracota">
              {visitasUltimos30Dias.toLocaleString('es-ES')}
            </div>
          </div>
        </div>
      </div>

      {/* Visitas por sección */}
      {visitasPorSeccion.length > 0 && (
        <div>
          <h2 className="mb-4 font-serif-dm text-2xl text-tinta">Visitas por sección (últimos 30 días)</h2>
          <div className="space-y-2 border border-filete p-4">
            {visitasPorSeccion.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="min-w-[120px] font-serif-spectral text-sm text-pardo">
                  {item.seccion || 'Sin clasificar'}
                </div>
                <div className="flex-1">
                  <div className="flex h-6 items-center overflow-hidden bg-filete/60">
                    <div
                      className="h-full bg-terracota"
                      style={{
                        width: `${Math.min(100, (item.total / (visitasPorSeccion[0]?.total || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="min-w-[60px] text-right font-mono-ibm text-xs text-tinta">
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
          <h2 className="mb-4 font-serif-dm text-2xl text-tinta">Eventos por organización</h2>
          <div className="overflow-x-auto border border-tinta">
            <table className="w-full font-serif-spectral text-sm text-tinta">
              <thead className="bg-papel-calido">
                <tr className="border-b border-filete">
                  <th className="px-4 py-3 text-left font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Organización</th>
                  <th className="px-4 py-3 text-center font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Eventos publicados</th>
                </tr>
              </thead>
              <tbody>
                {eventosPorOrganizacion.map((item) => (
                  <tr key={item.organizacionId} className="border-b border-filete hover:bg-papel-calido/60">
                    <td className="px-4 py-3 font-medium">{item.organizacionNombre}</td>
                    <td className="px-4 py-3 text-center font-serif-dm text-lg text-terracota">{item.total}</td>
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
          <h2 className="mb-4 font-serif-dm text-2xl text-tinta">Preguntas más frecuentes al asistente</h2>
          <div className="space-y-2 border border-filete p-4">
            {preguntasFrequentes.slice(0, 10).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-filete py-2 last:border-0">
                <div className="line-clamp-2 flex-1 font-serif-spectral text-sm text-tinta-apagada">
                  {item.pregunta || 'Sin pregunta'}
                </div>
                <div className="ml-4 inline-block bg-papel-calido px-2 py-1 font-mono-ibm text-[10px] text-terracota">
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
          <h2 className="mb-4 font-serif-dm text-2xl text-tinta">Comercios más buscados</h2>
          <div className="space-y-2 border border-filete p-4">
            {comerciosBuscados.slice(0, 10).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-filete py-2 last:border-0">
                <div className="flex-1 font-serif-spectral text-sm text-tinta">
                  {item.comercio || 'Sin nombre'}
                </div>
                <div className="ml-4 inline-block bg-papel-calido px-2 py-1 font-mono-ibm text-[10px] text-terracota">
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
