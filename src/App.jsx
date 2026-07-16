import { useState } from 'react'
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
import Login from './pages/Login.jsx'
import Registro from './pages/Registro.jsx'
import AdminEntrada from './pages/admin/AdminEntrada.jsx'
import AdminPanel from './pages/panel/AdminPanel.jsx'
import AdminEventoForm from './pages/panel/AdminEventoForm.jsx'

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
  const [isAccessGranted, setIsAccessGranted] = useState(false)
  const { pathname } = useLocation()

  const handleLogout = () => {
    localStorage.removeItem('ncv_access')
    setIsAccessGranted(false)
  }

  // El panel de gestión tiene su propio login (email + contraseña de la
  // organización, o del superadmin), así que no pasa por la contraseña del
  // portal vecinal.
  const RUTAS_GESTION = ['/admin', '/panel', '/login', '/registro']
  const esGestion = RUTAS_GESTION.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  if (!esGestion && !isAccessGranted) {
    return <AccessScreen onAccessGranted={() => setIsAccessGranted(true)} />
  }

  return (
    <>
      <ScrollManager />
      <OfflineIndicator />
      <InstallPrompt />
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
