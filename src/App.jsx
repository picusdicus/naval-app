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
import AdminLogin from './pages/admin/AdminLogin.jsx'
import AdminPanel from './pages/admin/AdminPanel.jsx'
import AdminEventoForm from './pages/admin/AdminEventoForm.jsx'

function ProveedorAdmin() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  )
}

export default function App() {
  const [isAccessGranted, setIsAccessGranted] = useState(false)
  const { pathname } = useLocation()

  const handleLogout = () => {
    localStorage.removeItem('ncv_access')
    setIsAccessGranted(false)
  }

  // El panel de gestión tiene su propio login (email + contraseña de la
  // organización), así que no pasa por la contraseña del portal vecinal.
  const esAdmin = pathname.startsWith('/admin')

  if (!esAdmin && !isAccessGranted) {
    return <AccessScreen onAccessGranted={() => setIsAccessGranted(true)} />
  }

  return (
    <>
      <ScrollManager />
      <OfflineIndicator />
      <InstallPrompt />
      <Routes>
        <Route path="/admin" element={<ProveedorAdmin />}>
          <Route path="login" element={<AdminLogin />} />
          <Route element={<RutaProtegida />}>
            <Route index element={<AdminPanel />} />
            <Route path="eventos/nuevo" element={<AdminEventoForm />} />
            {/* Misma página: con :id se prerrellena y guarda con PUT. */}
            <Route path="eventos/:id/editar" element={<AdminEventoForm />} />
            {/* Cualquier /admin/* desconocido pasa antes por RutaProtegida:
                sin sesión se redirige al login, con sesión al panel. */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>

        <Route element={<Layout onLogout={handleLogout} />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/eventos/:id" element={<EventoDetalle />} />
          <Route path="/mapa" element={<Mapa />} />
          <Route path="/noticias" element={<Noticias />} />
          <Route path="/noticias/:id" element={<NoticiaDetalle />} />
          <Route path="/transporte" element={<Transporte />} />
          <Route path="/asistente" element={<Asistente />} />
        </Route>
      </Routes>
    </>
  )
}
