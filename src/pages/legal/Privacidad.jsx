import { Link } from 'react-router-dom'

export default function Privacidad() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="mb-8 font-serif-dm text-seccion text-tinta">Política de privacidad</h1>

      <div className="space-y-6">
        {/* Introducción */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            1. Responsable del tratamiento
          </h2>
          <p className="mb-2 font-serif-spectral text-tinta-apagada">
            <strong>Responsable:</strong> [PENDIENTE: nombre de la entidad responsable]
          </p>
          <p className="mb-2 font-serif-spectral text-tinta-apagada">
            <strong>Correo de contacto:</strong>{' '}
            <a
              href="mailto:[PENDIENTE: email-de-contacto]"
              className="text-terracota hover:underline"
            >
              [PENDIENTE: email-de-contacto]
            </a>
          </p>
          <p className="font-serif-spectral text-tinta-apagada">
            Esta política explica cómo tratamos tus datos personales cuando usas Navalcarnero. Si
            tienes dudas, puedes contactarnos directamente.
          </p>
        </section>

        {/* Datos que recogemos */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            2. Datos que recogemos
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-serif-spectral font-semibold text-tinta">Acceso a la app (portal)</h3>
              <p className="mb-2 font-serif-spectral text-tinta-apagada">
                Para acceder al portal vecinal se verifica una contraseña compartida. No se
                almacena tu identidad: solo verificamos que conoces la contraseña y emitimos una
                cookie de sesión firmada (httpOnly, imposible de leer desde JavaScript, solo de
                servidor a servidor).
              </p>
              <p className="font-serif-spectral text-tinta-apagada">
                <strong>Dato:</strong> cookie de sesión (identificador temporal)
                <br />
                <strong>Plazo:</strong> 30 días
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-serif-spectral font-semibold text-tinta">Gestión de eventos y comercios</h3>
              <p className="mb-2 font-serif-spectral text-tinta-apagada">
                Si eres una organización que publica eventos o un comercio que gestiona su ficha,
                accedes a un panel con tu propia sesión (correo + contraseña hasheada en PBKDF2).
                Almacenamos tu correo, datos de tu organización/negocio y los eventos que publicas.
              </p>
              <p className="font-serif-spectral text-tinta-apagada">
                <strong>Datos:</strong> correo, nombre de organización, descripción, categoría de
                eventos, ubicación, imágenes de carteles
                <br />
                <strong>Plazo:</strong> mientras gestiones una cuenta (se borra si la eliminas)
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-serif-spectral font-semibold text-tinta">Notificaciones push (avisos)</h3>
              <p className="mb-2 font-serif-spectral text-tinta-apagada">
                Si activas los avisos sobre eventos nuevos, guardamos:
              </p>
              <ul className="ml-4 list-inside list-disc space-y-2 font-serif-spectral text-tinta-apagada">
                <li>
                  <strong>Identificador del dispositivo/navegador</strong> (endpoint): un número
                  único que te asigna tu navegador para recibir notificaciones push. Es anónimo: no
                  vinculamos esto a tu identidad.
                </li>
                <li>
                  <strong>Claves de cifrado</strong> (p256dh y auth): necesarias para enviar avisos
                  de forma segura.
                </li>
                <li>
                  <strong>Temas que elegiste</strong>: si prefieres avisos de cierta categoría o
                  organizador, guardamos tu selección.
                </li>
              </ul>
              <p className="mt-2 font-serif-spectral text-tinta-apagada">
                <strong>Plazo:</strong> mientras no desactives los avisos
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-serif-spectral font-semibold text-tinta">Historial de avisos (bandeja)</h3>
              <p className="mb-2 font-serif-spectral text-tinta-apagada">
                Los eventos anunciados en avisos se guardan en una bandeja pública (visible para
                cualquier persona que visite la app) para que puedas verlos si te los perdiste.
                <strong> Este historial no está vinculado a tu dispositivo ni identidad</strong> —
                no es "tu historial personal", sino el registro compartido de todos los avisos
                enviados. El servidor almacena:
              </p>
              <ul className="ml-4 list-inside list-disc space-y-2 font-serif-spectral text-tinta-apagada">
                <li>Título del evento</li>
                <li>Resumen (cuerpo del aviso)</li>
                <li>Enlace al evento</li>
                <li>Temas (categoría/organizador anunciado)</li>
                <li>Fecha de envío</li>
              </ul>
              <p className="mt-3 font-serif-spectral text-tinta-apagada">
                Localmente, en tu navegador, guardamos qué avisos has marcado como leídos o
                borrados (en localStorage, nunca en nuestros servidores) para personalizar la
                vista de la bandeja solo en este dispositivo.
              </p>
              <p className="mt-2 font-serif-spectral text-tinta-apagada">
                <strong>Plazo:</strong> últimos 60 días en el servidor (se poda automáticamente);
                el estado local se borra si limpias el navegador
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-serif-spectral font-semibold text-tinta">Analytics anónimos</h3>
              <p className="mb-2 font-serif-spectral text-tinta-apagada">
                Recogemos estadísticas de uso muy básicas:
              </p>
              <ul className="ml-4 list-inside list-disc space-y-2 font-serif-spectral text-tinta-apagada">
                <li>
                  <strong>Clics en eventos destacados:</strong> solo registramos "alguien clicó
                  esto" sin vincularlo a ti (vía sendBeacon, anónimo)
                </li>
                <li>
                  <strong>Evento visitado (desde el panel de administración):</strong> id de evento
                  y url visitada
                </li>
              </ul>
              <p className="mt-2 font-serif-spectral text-tinta-apagada">
                <strong>Plazo:</strong> se conservan agregados para análisis, sin identificadores
                individuales
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-serif-spectral font-semibold text-tinta">Cookies técnicas de sesión</h3>
              <p className="mb-2 font-serif-spectral text-tinta-apagada">
                Usamos cookies httpOnly (solo servidor, inaccesibles desde JavaScript) para:
              </p>
              <ul className="ml-4 list-inside list-disc space-y-2 font-serif-spectral text-tinta-apagada">
                <li>
                  <strong>ncv_portal / __Host-ncv_portal:</strong> acceso al portal vecinal
                  (30 días)
                </li>
                <li>
                  <strong>ncv_admin / __Host-ncv_admin:</strong> sesión de administrador o editor
                  (8 horas)
                </li>
              </ul>
              <p className="mt-2 font-serif-spectral text-tinta-apagada">
                Estas cookies son <strong>estrictamente necesarias</strong> para el funcionamiento
                de la app y no requieren consentimiento previo.
              </p>
            </div>
          </div>
        </section>

        {/* Base jurídica */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            3. Base jurídica
          </h2>
          <p className="mb-2 font-serif-spectral text-tinta-apagada">
            Tratamos tus datos sobre la base de:
          </p>
          <ul className="list-inside list-disc space-y-1 font-serif-spectral text-tinta-apagada">
            <li>
              <strong>Necesidad técnica:</strong> cookies de sesión, datos de gestión de cuentas
            </li>
            <li>
              <strong>Consentimiento:</strong> avisos push (das tu consentimiento al activarlos)
            </li>
            <li>
              <strong>Interés legítimo:</strong> análisis anónimo de uso
            </li>
          </ul>
        </section>

        {/* Tus derechos */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            4. Tus derechos (ARCO-POL)
          </h2>
          <p className="mb-3 font-serif-spectral text-tinta-apagada">
            Bajo la LSSI y RGPD tienes derecho a:
          </p>
          <ul className="list-inside list-disc space-y-2 font-serif-spectral text-tinta-apagada">
            <li>
              <strong>Acceso:</strong> ver qué datos personales tenemos tuyos
            </li>
            <li>
              <strong>Rectificación:</strong> corregir datos incorrectos
            </li>
            <li>
              <strong>Cancelación:</strong> pedir que borremos tus datos (eliminar tu cuenta)
            </li>
            <li>
              <strong>Oposición:</strong> oponerte al tratamiento para ciertos fines
            </li>
            <li>
              <strong>Portabilidad:</strong> recibir tus datos en formato estructurado (si aplica)
            </li>
          </ul>
          <p className="mt-4 font-serif-spectral text-tinta-apagada">
            Para ejercer cualquiera de estos derechos, escribe a:{' '}
            <a
              href="mailto:[PENDIENTE: email-de-contacto]"
              className="text-terracota hover:underline"
            >
              [PENDIENTE: email-de-contacto]
            </a>
          </p>
        </section>

        {/* Seguridad */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            5. Seguridad de tus datos
          </h2>
          <p className="mb-3 font-serif-spectral text-tinta-apagada">
            Implementamos medidas de seguridad técnicas y organizativas:
          </p>
          <ul className="list-inside list-disc space-y-1 font-serif-spectral text-tinta-apagada">
            <li>Conexión HTTPS encriptada</li>
            <li>Contraseñas hasheadas con PBKDF2 (no en texto plano)</li>
            <li>Cookies de sesión firmadas y httpOnly</li>
            <li>Validación de entrada en todos los formularios</li>
            <li>Rate limiting para prevenir ataques de fuerza bruta</li>
          </ul>
          <p className="mt-3 font-serif-spectral text-tinta-apagada">
            Sin embargo, no podemos garantizar seguridad 100 % — es una responsabilidad
            compartida.
          </p>
        </section>

        {/* Cambios en la política */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            6. Cambios en esta política
          </h2>
          <p className="font-serif-spectral text-tinta-apagada">
            Nos reservamos el derecho de actualizar esta política de privacidad. Te notificaremos
            de cambios significativos. Revisar esta página regularmente es tu responsabilidad.
          </p>
        </section>

        {/* Nota sobre la beta */}
        <section>
          <h2 className="mb-3 font-serif-dm text-xl text-tinta">
            7. Nota sobre el estado beta
          </h2>
          <p className="font-serif-spectral text-tinta-apagada">
            Navalcarnero está actualmente en fase beta privada. Esta política de privacidad se
            revisará y completará (tanto en el aspecto técnico como jurídico) antes de la
            apertura pública.
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
          <Link to="/cookies" className="text-terracota hover:underline">
            Política de cookies
          </Link>
        </p>
      </div>
    </div>
  )
}
