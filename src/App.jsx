import { useEffect, useState } from 'react'
import { Navigate, Outlet, Routes, Route, useLocation } from 'react-router-dom'
import ScrollManager from './components/ScrollManager.jsx'
import Layout from './components/layout/Layout.jsx'
import AccessScreen from './components/AccessScreen.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import OfflineIndicator from './components/OfflineIndicator.jsx'
import RutaProtegida from './components/admin/RutaProtegida.jsx'
import { AdminAuthProvider } from './lib/adminAuth.jsx'
import Inicio from './pages/Inicio.jsx'
import Eventos from './pages/Eventos.jsx'
import EventoDetalle from './pages/EventoDetalle.jsx'
import Mapa from './pages/Mapa.jsx'
import Noticias from './pages/Noticias.jsx'
import NoticiaDetalle from './pages/NoticiaDetalle.jsx'
import Transporte from './pages/Transporte.jsx'
import Asistente from './pages/Asistente.jsx'
import FAQ from './pages/FAQ.jsx'
import AvisoLegal from './pages/legal/AvisoLegal.jsx'
import Privacidad from './pages/legal/Privacidad.jsx'
import Cookies from './pages/legal/Cookies.jsx'
import Login from './pages/Login.jsx'
import Registro from './pages/Registro.jsx'
import AdminEntrada from './pages/admin/AdminEntrada.jsx'
import AdminPanel from './pages/panel/AdminPanel.jsx'
import AdminEventoForm from './pages/panel/AdminEventoForm.jsx'
import CookieBanner from './components/CookieBanner.jsx'

function ProveedorAdmin() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  )
}

// Redirección que conserva la query string: /mapa?comercio=X debe seguir
// abriendo la ficha en /comercios?comercio=X (enlaces y accesos antiguos).
function RedirigirConQuery({ a }) {
  const { search } = useLocation()
  return <Navigate to={`${a}${search}`} replace />
}

export default function App() {
  // El candado del portal se verifica en el servidor: al arrancar preguntamos si
  // la cookie de portal es válida (no confiamos en localStorage, que era falsificable).
  const [isAccessGranted, setIsAccessGranted] = useState(false)
  const [accesoComprobado, setAccesoComprobado] = useState(false)
  const { pathname } = useLocation()

  const RUTAS_GESTION = ['/admin', '/panel', '/login', '/registro']
  const esGestion = RUTAS_GESTION.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  useEffect(() => {
    // El panel de gestión tiene su propio login, así que no comprobamos el
    // candado del portal en esas rutas.
    if (esGestion) return
    let vigente = true
    fetch('/api/acceso')
      .then((r) => {
        if (vigente) setIsAccessGranted(r.ok)
      })
      .catch(() => {
        if (vigente) setIsAccessGranted(false)
      })
      .finally(() => {
        if (vigente) setAccesoComprobado(true)
      })
    return () => {
      vigente = false
    }
  }, [esGestion])

  const handleLogout = () => {
    fetch('/api/acceso', { method: 'DELETE' }).finally(() => setIsAccessGranted(false))
  }

  if (!esGestion) {
    // Mientras no sepamos si el candado está abierto, no pintamos nada (evita el
    // parpadeo de la pantalla de acceso antes de resolver la cookie).
    if (!accesoComprobado) return null
    if (!isAccessGranted) {
      return <AccessScreen onAccessGranted={() => setIsAccessGranted(true)} />
    }
  }

  return (
    <>
      <ScrollManager />
      <OfflineIndicator />
      <InstallPrompt />
      <CookieBanner />
      <Routes>
        <Route element={<ProveedorAdmin />}>
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
        </Route>

        <Route element={<Layout onLogout={handleLogout} />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/eventos/:id" element={<EventoDetalle />} />
          <Route path="/comercios" element={<Mapa />} />
          <Route path="/noticias" element={<Noticias />} />
          <Route path="/noticias/:id" element={<NoticiaDetalle />} />
          <Route path="/transporte" element={<Transporte />} />
          <Route path="/asistente" element={<Asistente />} />
          <Route path="/ayuda" element={<FAQ />} />
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
  )
}
