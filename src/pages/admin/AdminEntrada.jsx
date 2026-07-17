import { Navigate } from 'react-router-dom'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import FormularioLogin from '../../components/admin/FormularioLogin.jsx'
import AdminSuperPanel from './AdminSuperPanel.jsx'

/**
 * Elemento de la ruta /admin: sin sesión muestra el login de superadmin
 * (api/admin/login.js); con sesión de superadmin, su panel directamente
 * (antes en /admin/super); un admin/editor que llegue aquí por error va a
 * su panel de organización en /panel.
 */
export default function AdminEntrada() {
  const { usuario, cargando } = useAdminAuth()

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
          role="status"
          aria-label="Cargando"
        />
      </div>
    )
  }

  if (!usuario) {
    return (
      <FormularioLogin
        titulo="Superadministración"
        subtitulo="Acceso restringido al equipo de En Navalcarnero"
        icono="verified_admin"
        endpoint="/api/admin/login"
        destinoDefecto="/admin"
      />
    )
  }

  if (usuario.rol !== 'superadmin') return <Navigate to="/panel" replace />

  return <AdminSuperPanel />
}
