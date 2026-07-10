import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../../lib/adminAuth.jsx'

/**
 * Envuelve las rutas privadas de /admin. Mientras se comprueba la cookie de
 * sesión no se decide nada (si no, un usuario válido vería un parpadeo del
 * login); sin sesión, se redirige a /admin/login recordando el destino.
 */
export default function RutaProtegida() {
  const { usuario, cargando } = useAdminAuth()
  const ubicacion = useLocation()

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-container-low">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
          role="status"
          aria-label="Comprobando sesión"
        />
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/admin/login" replace state={{ desde: ubicacion.pathname }} />
  }

  return <Outlet />
}
