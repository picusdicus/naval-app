import { Navigate, Outlet } from 'react-router-dom'
import { useAdminAuth } from '../../lib/adminAuth.jsx'

export default function RutaSuperAdmin() {
  const { usuario, cargando } = useAdminAuth()

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-on-surface/50">Cargando…</div>
      </div>
    )
  }

  // Sin sesión o no es superadmin: 403.
  if (!usuario || usuario.rol !== 'superadmin') {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
