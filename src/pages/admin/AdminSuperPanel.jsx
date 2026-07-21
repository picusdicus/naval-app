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

  const TABS = [
    ['organizaciones', 'business', 'Organizaciones'],
    ['codigos', 'card_giftcard', 'Códigos de invitación'],
    ['destacados', 'star', 'Destacados'],
    ['analytics', 'analytics', 'Analytics'],
  ]

  return (
    <div className="min-h-screen bg-papel-lienzo">
      <div className="h-2 bg-tinta-intensa" />
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="font-serif-dm text-seccion text-tinta">Panel Superadmin</h1>
          <p className="mt-1 font-serif-spectral text-sm text-pardo">
            Gestión global de organizaciones, códigos y métricas
          </p>
        </div>

        {/* Tabs: con cuatro secciones ya no caben en un móvil, así que la fila
            hace scroll horizontal en vez de encoger (y solapar) los botones.
            Activa: subrayado terracota (ref. 6a). */}
        <div className="hide-scrollbar mb-6 flex gap-6 overflow-x-auto border-b border-filete font-mono-ibm text-[11px] uppercase tracking-etiqueta">
          {TABS.map(([clave, icono, etiqueta]) => (
            <button
              key={clave}
              onClick={() => setSeccionActiva(clave)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 transition-colors ${
                seccionActiva === clave
                  ? 'border-terracota text-tinta'
                  : 'border-transparent text-pardo hover:text-tinta'
              }`}
            >
              <MIcon name={icono} className="text-[16px]" />
              {etiqueta}
              {clave === 'destacados' && pendientes > 0 && (
                <span className="min-w-[1.25rem] rounded-full bg-terracota px-1.5 py-0.5 text-center text-[10px] font-bold text-papel">
                  {pendientes}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="border border-tinta bg-papel p-6">
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
