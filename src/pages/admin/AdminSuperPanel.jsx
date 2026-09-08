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
import CabeceraMovilSuperAdmin from '../../components/admin/super/CabeceraMovilSuperAdmin.jsx'
import BarraInferiorSuperAdmin from '../../components/admin/super/BarraInferiorSuperAdmin.jsx'
import DrawerSuperAdmin from '../../components/admin/super/DrawerSuperAdmin.jsx'
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
  const [menuAbierto, setMenuAbierto] = useState(false)
  const escritorio = useMediaQuery(MQ_ESCRITORIO)

  // Al pasar a escritorio la navegación es la sidebar: un drawer que quedara
  // abierto sería una segunda navegación montada a la vez.
  useEffect(() => {
    if (escritorio) setMenuAbierto(false)
  }, [escritorio])

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
        {!escritorio && (
          <CabeceraMovilSuperAdmin
            usuario={usuario}
            resumen={resumen}
            onAbrirMenu={() => setMenuAbierto(true)}
            onIrAResumen={() => setSeccionActiva('resumen')}
            onAbrirInfoUsuario={() => setDialogoInfoAbierto(true)}
          />
        )}

        {/* En móvil el contenido termina por debajo de la barra inferior fija;
            sin este hueco, la última fila de cualquier tabla queda tapada. */}
        <div className={`mx-auto max-w-7xl p-4 sm:p-6 ${escritorio ? '' : 'pb-28'}`}>
          {/* Encabezado. En móvil lo sustituyen la cabecera sticky y la barra
              inferior; el <h1> sigue en el DOM (solo para lectores de
              pantalla) porque es el nombre de la página, no una decoración. */}
          {escritorio ? (
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
          ) : (
            <h1 className="sr-only">Panel Superadmin</h1>
          )}

          {/* Contenido. Estas secciones usan ya la paleta nocturna en su
              contenido (y no solo en la sidebar): el envoltorio se oscurece
              con ellas. Al migrar una sección más, sumar su clave a esta lista
              en vez de duplicar el envoltorio. */}
          <div
            className={
              ['organizaciones', 'codigos', 'destacados'].includes(seccionActiva)
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

        {!escritorio && (
          <BarraInferiorSuperAdmin
            seccionActiva={seccionActiva}
            onCambiarSeccion={setSeccionActiva}
            onAbrirMenu={() => setMenuAbierto(true)}
            resumen={resumen}
          />
        )}

        {/* Montaje condicional, no `hidden`: cerrado no debe existir en el DOM
            (ver el comentario de useMediaQuery y el del propio drawer). */}
        {!escritorio && menuAbierto && (
          <DrawerSuperAdmin
            seccionActiva={seccionActiva}
            onCambiarSeccion={setSeccionActiva}
            onCerrar={() => setMenuAbierto(false)}
            resumen={resumen}
            usuario={usuario}
            onCerrarSesion={cerrarSesion}
          />
        )}
      </div>
    </div>
  )
}
