import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import MIcon from '../../components/MIcon.jsx'
import TablesOrganizaciones from '../../components/admin/super/TablesOrganizaciones.jsx'
import TablesCodigosInvitacion from '../../components/admin/super/TablesCodigosInvitacion.jsx'
import TableReclamaciones from '../../components/admin/super/TableReclamaciones.jsx'
import TableAltasComercio from '../../components/admin/super/TableAltasComercio.jsx'
import TablesDestacados from '../../components/admin/super/TablesDestacados.jsx'
import TablesEventos from '../../components/admin/super/TablesEventos.jsx'
import TablesTalleres from '../../components/admin/super/TablesTalleres.jsx'
import TablesPendientes from '../../components/admin/super/TablesPendientes.jsx'
import TablesComercios from '../../components/admin/super/TablesComercios.jsx'
import PanelImagenesGenericas from '../../components/admin/super/PanelImagenesGenericas.jsx'
import TableAnalytics from '../../components/admin/super/TableAnalytics.jsx'
import UmamiStats from '../../components/admin/UmamiStats.jsx'
import DialogoInfoUsuario from '../../components/admin/DialogoInfoUsuario.jsx'
import SidebarSuperAdmin from '../../components/admin/super/SidebarSuperAdmin.jsx'
import ResumenSuperAdmin from '../../components/admin/super/ResumenSuperAdmin.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'

// Ancho a partir del cual el panel usa la sidebar en vez de la fila de tabs.
// Coincide con el breakpoint `lg` de Tailwind.
const MQ_ESCRITORIO = '(min-width: 1024px)'

// Hook de viewport (mismo patrón que el de src/pages/Mapa.jsx). Aquí NO vale
// ocultar una de las dos navegaciones con clases `hidden`: ambas seguirían en
// el DOM y cualquier recuento de botones por texto —el de los e2e, el de un
// lector de pantalla— vería la navegación por duplicado.
function useMediaQuery(query) {
  const [match, setMatch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatch(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return match
}

export default function AdminSuperPanel() {
  const { usuario, cerrarSesion } = useAdminAuth()
  const [seccionActiva, setSeccionActiva] = useState('organizaciones')
  const [umamiSummary, setUmamiSummary] = useState(null)
  const [dialogoInfoAbierto, setDialogoInfoAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const escritorio = useMediaQuery(MQ_ESCRITORIO)

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

  // Todos los contadores del panel en una sola llamada: antes eran tres GET
  // que se traían listas enteras (destacados, pendientes, propuestas) solo
  // para quedarse con su `length`. Se recuentan al montar y al cambiar de
  // sección (así se refrescan tras gestionar dentro del propio tab); pueden ir
  // un refresco por detrás sin salir del tab, y no pasa nada.
  const [resumen, setResumen] = useState(null)
  useEffect(() => {
    let vigente = true

    fetch('/api/super/resumen')
      .then((r) => (r.ok ? r.json() : null))
      .then((datos) => {
        if (vigente && datos) setResumen(datos)
      })
      .catch(() => {})

    return () => {
      vigente = false
    }
  }, [seccionActiva])

  const TABS = [
    ['resumen', 'dashboard', 'Resumen'],
    ['organizaciones', 'business', 'Organizaciones'],
    ['codigos', 'card_giftcard', 'Códigos de invitación'],
    ['reclamaciones', 'verified_user', 'Reclamaciones'],
    ['altas', 'add_business', 'Altas'],
    ['destacados', 'star', 'Destacados'],
    ['pendientes', 'pending_actions', 'Pendientes'],
    ['eventos', 'event', 'Eventos'],
    ['talleres', 'school', 'Talleres'],
    ['comercios', 'storefront', 'Comercios'],
    ['imagenes', 'image', 'Imágenes genéricas'],
    ['analytics', 'analytics', 'Analytics'],
  ]

  // Contadores con cola de trabajo, para las pastillas de la barra móvil.
  const avisosPorTab = {
    destacados: resumen?.destacadosRequierenAccion,
    pendientes: resumen?.pendientesSync,
    talleres: resumen?.propuestasTalleres,
    reclamaciones: resumen?.reclamacionesPendientes,
    altas: resumen?.altasPendientes,
  }

  const contenido = (
    <>
      {seccionActiva === 'resumen' && (
        <ResumenSuperAdmin
          resumen={resumen}
          usuario={usuario}
          onCambiarSeccion={setSeccionActiva}
        />
      )}
      {seccionActiva === 'organizaciones' && <TablesOrganizaciones />}
      {seccionActiva === 'codigos' && <TablesCodigosInvitacion />}
      {seccionActiva === 'reclamaciones' && <TableReclamaciones />}
      {seccionActiva === 'altas' && <TableAltasComercio />}
      {seccionActiva === 'destacados' && <TablesDestacados />}
      {seccionActiva === 'pendientes' && <TablesPendientes />}
      {seccionActiva === 'eventos' && <TablesEventos />}
      {seccionActiva === 'talleres' && <TablesTalleres />}
      {seccionActiva === 'comercios' && <TablesComercios />}
      {seccionActiva === 'imagenes' && <PanelImagenesGenericas />}
      {seccionActiva === 'analytics' && (
        <div className="space-y-8">
          <TableAnalytics umamiSummary={umamiSummary} />
          <UmamiStats
            umamiDashboardUrl="https://umami-navalcarnero.vercel.app"
            onStatsLoaded={handleStatsLoaded}
          />
        </div>
      )}
    </>
  )

  return (
    <div className="flex min-h-screen bg-papel-lienzo">
      {escritorio && (
        <SidebarSuperAdmin
          seccionActiva={seccionActiva}
          onCambiarSeccion={setSeccionActiva}
          resumen={resumen}
          usuario={usuario}
          onAbrirInfoUsuario={() => setDialogoInfoAbierto(true)}
          onCerrarSesion={cerrarSesion}
        />
      )}

      <div className="min-w-0 flex-1">
        {!escritorio && <div className="h-2 bg-tinta-intensa" />}
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

          {/* Tabs: solo en móvil/tableta — en escritorio la navegación es la
              sidebar, y montar las dos a la vez duplicaría la navegación en el
              DOM. La fila hace scroll horizontal en vez de encoger (y solapar)
              los botones. Activa: subrayado terracota (ref. 6a). */}
          {!escritorio && (
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
                  {avisosPorTab[clave] > 0 && (
                    <span className="min-w-[1.25rem] rounded-full bg-terracota px-1.5 py-0.5 text-center text-[10px] font-bold text-papel">
                      {avisosPorTab[clave]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Contenido. Organizaciones es la primera sección cuyo contenido
              (y no solo la sidebar) usa la paleta nocturna: el envoltorio se
              oscurece con ella. Al migrar Códigos o Destacados, sumar su clave
              a esta condición en vez de duplicar el envoltorio. */}
          <div
            className={
              seccionActiva === 'organizaciones'
                ? 'border border-nocturno-outline bg-nocturno-fondo p-6'
                : 'border border-tinta bg-papel p-6'
            }
          >
            {contenido}
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
    </div>
  )
}
