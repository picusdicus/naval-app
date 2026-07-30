import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import MIcon from '../../components/MIcon.jsx'
import TablesOrganizaciones from '../../components/admin/super/TablesOrganizaciones.jsx'
import TablesCodigosInvitacion from '../../components/admin/super/TablesCodigosInvitacion.jsx'
import TablesDestacados from '../../components/admin/super/TablesDestacados.jsx'
import TablesEventos from '../../components/admin/super/TablesEventos.jsx'
import TablesComercios from '../../components/admin/super/TablesComercios.jsx'
import TableAnalytics from '../../components/admin/super/TableAnalytics.jsx'
import UmamiStats from '../../components/admin/UmamiStats.jsx'
import DialogoInfoUsuario from '../../components/admin/DialogoInfoUsuario.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'

export default function AdminSuperPanel() {
  const { usuario, cerrarSesion } = useAdminAuth()
  const [seccionActiva, setSeccionActiva] = useState('organizaciones')
  const [umamiSummary, setUmamiSummary] = useState(null)
  const [pendientes, setPendientes] = useState(0)
  const [dialogoInfoAbierto, setDialogoInfoAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const handleStatsLoaded = useCallback((summary) => {
    setUmamiSummary(summary)
  }, [])

  const handleCambiarPassword = async (credenciales) => {
    setOcupado(true)
    try {
      const respuesta = await fetch('/api/admin/cambiar-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credenciales),
      })

      if (respuesta.status === 401) {
        throw new Error('La contraseña actual es incorrecta.')
      }
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(datos.error || 'No se pudo cambiar la contraseña.')
      }

      setTimeout(() => {
        setDialogoInfoAbierto(false)
      }, 2000)
    } catch (err) {
      throw err
    } finally {
      setOcupado(false)
    }
  }

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
    ['eventos', 'event', 'Eventos'],
    ['comercios', 'storefront', 'Comercios'],
    ['analytics', 'analytics', 'Analytics'],
  ]

  return (
    <div className="min-h-screen bg-papel-lienzo">
      <div className="h-2 bg-tinta-intensa" />
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        {/* Encabezado */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-serif-dm text-seccion text-tinta">Panel Superadmin</h1>
            <p className="mt-1 font-serif-spectral text-sm text-pardo">
              Gestión global de organizaciones, códigos y métricas
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-papel-calido"
              title="Volver a la app pública"
            >
              <MIcon name="home" className="text-[16px]" />
              <span className="hidden sm:inline">Volver a la app</span>
            </Link>

            <button
              type="button"
              onClick={() => setDialogoInfoAbierto(true)}
              className="inline-flex items-center gap-2 border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-papel-calido"
              title="Información de usuario"
            >
              <MIcon name="account_circle" className="text-[16px]" />
              <span className="hidden sm:inline">Usuario</span>
            </button>

            <button
              type="button"
              onClick={cerrarSesion}
              className="inline-flex items-center gap-2 border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-papel-calido"
            >
              <MIcon name="logout" className="text-[16px]" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
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
          {seccionActiva === 'eventos' && <TablesEventos />}
          {seccionActiva === 'comercios' && <TablesComercios />}
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

        <DialogoInfoUsuario
          abierto={dialogoInfoAbierto}
          usuario={usuario}
          ocupado={ocupado}
          onCambiarPassword={handleCambiarPassword}
          onCerrar={() => setDialogoInfoAbierto(false)}
        />
      </div>
    </div>
  )
}
