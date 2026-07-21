import { Link } from 'react-router-dom'

export default function Cookies() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="mb-8 font-serif-dm text-seccion text-tinta">Política de cookies</h1>

      <div className="space-y-6">
        {/* Introducción */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            1. ¿Qué es una cookie?
          </h2>
          <p className="font-serif-spectral text-tinta-apagada">
            Una cookie es un pequeño archivo de texto que tu navegador almacena en tu dispositivo
            cuando visitas un sitio web. Se envía al servidor en cada petición, permitiendo que
            recuerde información sobre tu sesión (por ejemplo, si has iniciado sesión).
          </p>
        </section>

        {/* Cookies que usamos */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            2. Cookies que usamos
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-serif-spectral font-semibold text-tinta">Cookies técnicas de sesión</h3>
              <p className="mb-2 font-serif-spectral text-tinta-apagada">
                Estas cookies son <strong>estrictamente necesarias</strong> para que la app
                funcione. No requieren consentimiento previo (LSSI art. 6.5).
              </p>
              <div className="space-y-2 bg-papel-calido p-3">
                <div>
                  <p className="font-serif-spectral text-sm font-semibold text-tinta">ncv_portal</p>
                  <p className="mt-1 font-mono-ibm text-[10px] text-mudo">
                    Acceso al portal vecinal. Verificamos que conoces la contraseña compartida.
                  </p>
                  <p className="mt-1 font-mono-ibm text-[10px] text-mudo">
                    <strong>Plazo:</strong> 30 días | <strong>httpOnly:</strong> sí (servidor solo)
                  </p>
                </div>
                <div className="border-t border-filete pt-2">
                  <p className="font-serif-spectral text-sm font-semibold text-tinta">
                    ncv_admin / __Host-ncv_admin
                  </p>
                  <p className="mt-1 font-mono-ibm text-[10px] text-mudo">
                    Sesión de administrador o editor de eventos. Identificamos tu rol en la
                    organización.
                  </p>
                  <p className="mt-1 font-mono-ibm text-[10px] text-mudo">
                    <strong>Plazo:</strong> 8 horas | <strong>httpOnly:</strong> sí (servidor solo)
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-serif-spectral font-semibold text-tinta">Cookies de terceros</h3>
              <p className="font-serif-spectral text-tinta-apagada">
                No usamos cookies de terceros para publicidad, seguimiento de comportamiento o
                análisis de tráfico. Las analíticas (muy limitadas) son anónimas y no vinculadas a
                cookies.
              </p>
            </div>
          </div>
        </section>

        {/* Cómo funciona el acceso */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            3. Cómo manejamos las cookies
          </h2>
          <p className="mb-3 font-serif-spectral text-tinta-apagada">
            <strong>Seguridad:</strong>
          </p>
          <ul className="list-inside list-disc space-y-2 font-serif-spectral text-tinta-apagada">
            <li>
              <strong>httpOnly:</strong> las cookies no son accesibles desde JavaScript. Ni siquiera
              tu navegador puede leerlas (defensa contra XSS).
            </li>
            <li>
              <strong>Secure:</strong> en producción, las cookies se envían solo por HTTPS.
            </li>
            <li>
              <strong>Firmadas:</strong> cada cookie incluye una firma HS256 que validamos en el
              servidor. Si alguien intenta falsificarla, falla.
            </li>
            <li>
              <strong>SameSite:</strong> Strict en el panel (solo mismo origen), Lax en el portal
              (protege contra CSRF).
            </li>
          </ul>
        </section>

        {/* Gestionar cookies */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            4. Cómo gestionar tus cookies
          </h2>
          <p className="mb-3 font-serif-spectral text-tinta-apagada">
            Dado que nuestras cookies son estrictamente necesarias (no hay cookies opcionales),
            <strong> no hay cookies que rechazar</strong>. Si no quieres que se guarden:
          </p>
          <ul className="list-inside list-disc space-y-2 font-serif-spectral text-tinta-apagada">
            <li>
              <strong>Cerrar sesión:</strong> usa el botón "Cerrar sesión" en la esquina (Footer o
              MenuDrawer). Esto borra la cookie.
            </li>
            <li>
              <strong>Limpiar cookies del navegador:</strong> accede a la configuración de tu
              navegador y borra cookies de navalcarnero-app.vercel.app (o el dominio actual).
            </li>
            <li>
              <strong>Modo incógnito:</strong> las cookies se borran al cerrar la ventana.
            </li>
          </ul>
          <p className="mt-3 font-serif-spectral text-tinta-apagada">
            Ten en cuenta que si borras la cookie de sesión, perderás el acceso a funciones que la
            requieran (como el panel de administración).
          </p>
        </section>

        {/* Banner de cookies */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            5. Banner de cookies
          </h2>
          <p className="font-serif-spectral text-tinta-apagada">
            Como nuestras cookies son estrictamente necesarias y no requieren consentimiento
            previo, es posible que no veas un banner de "aceptar/rechazar cookies" en cada visita.
            El banner que sí puede aparecer es solo un aviso informativo, no un consentimiento.
          </p>
        </section>

        {/* Avisos push */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            6. Avisos push (push notifications)
          </h2>
          <p className="mb-2 font-serif-spectral text-tinta-apagada">
            Los avisos push no son cookies (se guardan de forma distinta), pero sí requieren tu
            consentimiento explícito. Cuando activas avisos:
          </p>
          <ul className="list-inside list-disc space-y-2 font-serif-spectral text-tinta-apagada">
            <li>Tu navegador te pide permiso</li>
            <li>Guardamos un identificador anónimo de tu dispositivo (endpoint)</li>
            <li>Guardamos tus preferencias de temas en tu navegador (localStorage)</li>
          </ul>
          <p className="mt-2 font-serif-spectral text-tinta-apagada">
            Puedes desactivar los avisos en cualquier momento desde el diálogo "Avisos de la
            agenda" en la página de eventos. Para más detalles, consulta la{' '}
            <Link to="/privacidad" className="text-terracota hover:underline">
              Política de privacidad
            </Link>
            .
          </p>
        </section>

        {/* Información de contacto */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            7. Preguntas o derechos
          </h2>
          <p className="mb-2 font-serif-spectral text-tinta-apagada">
            Si tienes dudas sobre cómo usamos cookies o quieres ejercer tus derechos ARCO-POL,
            puedes escribir a:
          </p>
          <p className="font-serif-spectral text-tinta-apagada">
            <a
              href="mailto:[PENDIENTE: email-de-contacto]"
              className="text-terracota hover:underline"
            >
              [PENDIENTE: email-de-contacto]
            </a>
          </p>
        </section>
      </div>

      {/* Enlaces relacionados */}
      <div className="mt-12 border-t border-filete pt-8">
        <p className="font-serif-spectral text-sm text-pardo">
          También te puede interesar:{' '}
          <Link to="/aviso-legal" className="text-terracota hover:underline">
            Aviso legal
          </Link>
          {' · '}
          <Link to="/privacidad" className="text-terracota hover:underline">
            Política de privacidad
          </Link>
        </p>
      </div>
    </div>
  )
}
