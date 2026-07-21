import FormularioLogin from '../components/admin/FormularioLogin.jsx'

/** Login de organizaciones (admin/editor) — /login. Ver api/login.js. */
export default function Login() {
  return (
    <FormularioLogin
      titulo="Panel de gestión"
      subtitulo="Accede con las credenciales de tu organización"
      icono="admin_panel_settings"
      endpoint="/api/login"
      destinoDefecto="/panel"
      pie={
        <>
          <p>
            ¿Eres una organización nueva?{' '}
            <a href="/registro" className="font-semibold text-terracota hover:underline">
              Regístrate aquí
            </a>
          </p>
          <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta">
            Acceso restringido · solo con código de invitación
          </p>
        </>
      }
    />
  )
}
