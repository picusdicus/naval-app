import { useState, useCallback, useEffect } from 'react'
import MIcon from '../../components/MIcon.jsx'
import TablesOrganizaciones from '../../components/admin/super/TablesOrganizaciones.jsx'
import TablesCodigosInvitacion from '../../components/admin/super/TablesCodigosInvitacion.jsx'
import TablesDestacados from '../../components/admin/super/TablesDestacados.jsx'
import TableAnalytics from '../../components/admin/super/TableAnalytics.jsx'
import UmamiStats from '../../components/admin/UmamiStats.jsx'

export default function AdminSuperPanel() {
  const [seccionActiva, setSeccionActiva] = useState('organizaciones')
  const [umamiSummary, setUmamiSummary] = useState(null)
  const [pendientes, setPendientes] = useState(0)

  const handleStatsLoaded = useCallback((summary) => {
    setUmamiSummary(summary)
  }, [])

  // Solicitudes de destacado sin gestionar, para el contador del tab. Se
  // recuenta al montar y al cambiar de sección (así se refresca tras aprobar
  // o rechazar dentro del propio tab); puede ir un refresco por detrás
  // mientras se gestiona sin salir del tab, y no pasa nada.
  useEffect(() => {
    let vigente = true

    fetch('/api/super/destacados')
      .then((r) => (r.ok ? r.json() : { destacados: [] }))
      .then(({ destacados = [] }) => {
        if (vigente) setPendientes(destacados.filter((d) => d.estado === 'pendiente').length)
      })
      .catch(() => {})

    return () => {
      vigente = false
    }
  }, [seccionActiva])

  return (
    <div className="min-h-screen bg-surface-container-low p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Encabezado */}
        <div className="mb-8">
          <h1 className="mb-2 font-display text-3xl font-bold text-primary">Panel Superadmin</h1>
          <p className="text-on-surface/70">Gestión global de organizaciones, códigos y métricas</p>
        </div>

        {/* Tabs: con cuatro secciones ya no caben en un móvil, así que la fila
            hace scroll horizontal en vez de encoger (y solapar) los botones. */}
        <div className="hide-scrollbar mb-6 flex gap-2 overflow-x-auto border-b border-outline-variant">
          <button
            onClick={() => setSeccionActiva('organizaciones')}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-semibold transition-colors ${
              seccionActiva === 'organizaciones'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface/60 hover:text-on-surface'
            }`}
          >
            <MIcon name="business" className="text-[20px]" />
            Organizaciones
          </button>
          <button
            onClick={() => setSeccionActiva('codigos')}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-semibold transition-colors ${
              seccionActiva === 'codigos'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface/60 hover:text-on-surface'
            }`}
          >
            <MIcon name="card_giftcard" className="text-[20px]" />
            Códigos de invitación
          </button>
          <button
            onClick={() => setSeccionActiva('destacados')}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-semibold transition-colors ${
              seccionActiva === 'destacados'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface/60 hover:text-on-surface'
            }`}
          >
            <MIcon name="star" className="text-[20px]" />
            Destacados
            {pendientes > 0 && (
              <span className="min-w-[1.25rem] rounded-full bg-primary px-1.5 py-0.5 text-center text-xs font-bold text-on-primary">
                {pendientes}
              </span>
            )}
          </button>
          <button
            onClick={() => setSeccionActiva('analytics')}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-semibold transition-colors ${
              seccionActiva === 'analytics'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface/60 hover:text-on-surface'
            }`}
          >
            <MIcon name="analytics" className="text-[20px]" />
            Analytics
          </button>
        </div>

        {/* Contenido */}
        <div className="rounded-lg bg-surface-container-lowest p-6">
          {seccionActiva === 'organizaciones' && <TablesOrganizaciones />}
          {seccionActiva === 'codigos' && <TablesCodigosInvitacion />}
          {seccionActiva === 'destacados' && <TablesDestacados />}
          {seccionActiva === 'analytics' && (
            <div className="space-y-8">
              <TableAnalytics umamiSummary={umamiSummary} />
              <UmamiStats
                umamiDashboardUrl="https://umami-navalcarnero.vercel.app"
                onStatsLoaded={handleStatsLoaded}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
