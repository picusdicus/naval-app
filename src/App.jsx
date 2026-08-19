import { Navigate, Routes, Route, useLocation, useParams } from 'react-router-dom'
import ScrollManager from './components/ScrollManager.jsx'
import Layout from './components/layout/Layout.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import OfflineIndicator from './components/OfflineIndicator.jsx'
import RutaProtegida from './components/admin/RutaProtegida.jsx'
import { AdminAuthProvider } from './lib/adminAuth.jsx'
import Inicio from './pages/Inicio.jsx'
import Eventos from './pages/Eventos.jsx'
import EventoDetalle from './pages/EventoDetalle.jsx'
import ProgramaDelDia from './pages/ProgramaDelDia.jsx'
import Mapa from './pages/Mapa.jsx'
import Noticias from './pages/Noticias.jsx'
import NoticiaDetalle from './pages/NoticiaDetalle.jsx'
import Actividades from './pages/Actividades.jsx'
import Transporte from './pages/Transporte.jsx'
import FAQ from './pages/FAQ.jsx'
import Sugerencias from './pages/Sugerencias.jsx'
import PerfilComercio from './pages/PerfilComercio.jsx'
import AvisoLegal from './pages/legal/AvisoLegal.jsx'
import Privacidad from './pages/legal/Privacidad.jsx'
import Cookies from './pages/legal/Cookies.jsx'
import Login from './pages/Login.jsx'
import Registro from './pages/Registro.jsx'
import AdminEntrada from './pages/admin/AdminEntrada.jsx'
import AdminPanel from './pages/panel/AdminPanel.jsx'
import AdminEventoForm from './pages/panel/AdminEventoForm.jsx'
import CookieBanner from './components/CookieBanner.jsx'

// Redirección que conserva la query string: /mapa?comercio=X debe seguir
// abriendo la ficha en /comercios?comercio=X (enlaces y accesos antiguos).
function RedirigirConQuery({ a }) {
  const { search } = useLocation()
  return <Navigate to={`${a}${search}`} replace />
}

// /eventos/:id sirve dos vistas según el formato del segmento: una fecha
// 'YYYY-MM-DD' abre el programa del día (la cartelera de ese día); cualquier
// otro id abre la ficha del evento. Un solo route evita la colisión de
// especificidad entre dos rutas '/eventos/:param' (React Router no las
// distingue por sí solo) y mantiene la URL limpia del prototipo.
function EventoODiaCompleto() {
  const { id } = useParams()
  const esFecha = /^\d{4}-\d{2}-\d{2}$/.test(id)
  return esFecha ? <ProgramaDelDia /> : <EventoDetalle />
}

// /comercios sirve dos vistas: sin parámetro abre el mapa/listado; con
// parámetro (/comercios/:id o /comercios/local/...) abre el perfil. El wildcard
// permite IDs con slashes (ej: local/ocio_cultura-ac-imagina-magia).
function ComerciosRuta() {
  const { '*': restoDePath } = useParams()

  // Si no hay nada después de /comercios, mostrar el mapa
  if (!restoDePath) {
    return <Mapa />
  }

  // Si hay algo, mostrar el perfil con el ID completo (incluyendo slashes)
  return <PerfilComercio id={restoDePath} />
}

export default function App() {
  const { pathname } = useLocation()

  const RUTAS_GESTION = ['/admin', '/panel', '/login', '/registro']
  const esGestion = RUTAS_GESTION.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  const handleLogout = () => {
    fetch('/api/acceso', { method: 'DELETE' })
  }

  return (
    <AdminAuthProvider>
      <>
        <ScrollManager />
        <OfflineIndicator />
        <InstallPrompt />
        <CookieBanner />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          {/* Superadmin: login y su panel fusionados en la misma ruta. */}
          <Route path="/admin" element={<AdminEntrada />} />

          <Route path="/panel" element={<RutaProtegida />}>
            <Route index element={<AdminPanel />} />
            <Route path="eventos/nuevo" element={<AdminEventoForm />} />
            {/* Misma página: con :id se prerrellena y guarda con PUT. */}
            <Route path="eventos/:id/editar" element={<AdminEventoForm />} />
            {/* Cualquier /panel/* desconocido pasa antes por RutaProtegida:
                sin sesión se redirige al login, con sesión al panel. */}
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Route>

          <Route element={<Layout onLogout={handleLogout} />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/eventos" element={<Eventos />} />
            {/* Un solo route: fecha 'YYYY-MM-DD' → programa del día; id → ficha. */}
            <Route path="/eventos/:id" element={<EventoODiaCompleto />} />
            <Route path="/comercios/*" element={<ComerciosRuta />} />
            <Route path="/noticias" element={<Noticias />} />
            <Route path="/noticias/:id" element={<NoticiaDetalle />} />
            <Route path="/actividades" element={<Actividades />} />
            <Route path="/transporte" element={<Transporte />} />
            <Route path="/asistente" element={<Navigate to="/" replace />} />
            <Route path="/ayuda" element={<FAQ />} />
            <Route path="/sugerencias" element={<Sugerencias />} />
            <Route path="/aviso-legal" element={<AvisoLegal />} />
            <Route path="/privacidad" element={<Privacidad />} />
            <Route path="/cookies" element={<Cookies />} />
          </Route>

          {/* Rutas de antes de separar los logins: una organización puede
              tenerlas en favoritos. Redirigen en vez de dejar la página en
              blanco. `replace` evita que la URL rota quede en el historial. */}
          <Route path="/mapa" element={<RedirigirConQuery a="/comercios" />} />
          <Route path="/admin/login" element={<Navigate to="/login" replace />} />
          <Route path="/admin/registro" element={<Navigate to="/registro" replace />} />
          <Route path="/admin/super" element={<Navigate to="/admin" replace />} />

          {/* Lo que no capturó ningún <Route> anterior. React Router elige por
              especificidad, no por orden: este `*` de raíz es el menos
              específico, así que nunca le roba nada al `*` de /panel. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </>
    </AdminAuthProvider>
  )
}
