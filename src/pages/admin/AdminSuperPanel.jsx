import { useState, useCallback } from 'react'
import MIcon from '../../components/MIcon.jsx'
import TablesOrganizaciones from '../../components/admin/super/TablesOrganizaciones.jsx'
import TablesCodigosInvitacion from '../../components/admin/super/TablesCodigosInvitacion.jsx'
import TableAnalytics from '../../components/admin/super/TableAnalytics.jsx'
import UmamiStats from '../../components/admin/UmamiStats.jsx'

export default function AdminSuperPanel() {
  const [seccionActiva, setSeccionActiva] = useState('organizaciones')
  const [umamiSummary, setUmamiSummary] = useState(null)

  const handleStatsLoaded = useCallback((summary) => {
    setUmamiSummary(summary)
  }, [])

  return (
    <div className="min-h-screen bg-surface-container-low p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Encabezado */}
        <div className="mb-8">
          <h1 className="mb-2 font-display text-3xl font-bold text-primary">Panel Superadmin</h1>
          <p className="text-on-surface/70">Gestión global de organizaciones, códigos y métricas</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-outline-variant">
          <button
            onClick={() => setSeccionActiva('organizaciones')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 font-semibold transition-colors ${
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
            className={`flex items-center gap-2 border-b-2 px-4 py-3 font-semibold transition-colors ${
              seccionActiva === 'codigos'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface/60 hover:text-on-surface'
            }`}
          >
            <MIcon name="card_giftcard" className="text-[20px]" />
            Códigos de invitación
          </button>
          <button
            onClick={() => setSeccionActiva('analytics')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 font-semibold transition-colors ${
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
