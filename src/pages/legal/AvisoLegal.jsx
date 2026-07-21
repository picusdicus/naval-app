import { Link } from 'react-router-dom'

export default function AvisoLegal() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="font-display text-3xl font-bold text-primary mb-8">Aviso Legal</h1>

      <div className="space-y-6">
        {/* Titular y responsable */}
        <section>
          <h2 className="font-display text-xl font-semibold text-on-surface mb-3">
            1. Información del responsable
          </h2>
          <p className="text-on-surface/80 mb-2">
            <strong>Titular del sitio:</strong> [PENDIENTE: nombre de la entidad responsable]
          </p>
          <p className="text-on-surface/80 mb-2">
            <strong>Domicilio:</strong> Plaza de Segovia, 1 · 28600 Navalcarnero, Madrid
          </p>
          <p className="text-on-surface/80 mb-2">
            <strong>Correo electrónico:</strong>{' '}
            <a
              href="mailto:[PENDIENTE: email-de-contacto]"
              className="text-primary hover:underline"
            >
              [PENDIENTE: email-de-contacto]
            </a>
          </p>
          <p className="text-on-surface/80">
            <strong>Teléfono:</strong> 91 810 11 41 / 91 811 51 91
          </p>
        </section>

        {/* Naturaleza del sitio */}
        <section>
          <h2 className="font-display text-xl font-semibold text-on-surface mb-3">
            2. Naturaleza de este sitio
          </h2>
          <p className="text-on-surface/80">
            Este sitio web es una plataforma vecinal no oficial que proporciona información sobre
            agenda de eventos, directorio de comercios y servicios locales, noticias municipales,
            información de transporte y un asistente IA para trámites municipales en Navalcarnero.
            No es una web oficial del Ayuntamiento de Navalcarnero.
          </p>
        </section>

        {/* Licencia y contenido */}
        <section>
          <h2 className="font-display text-xl font-semibold text-on-surface mb-3">
            3. Licencia de uso del contenido
          </h2>
          <p className="text-on-surface/80 mb-3">
            El contenido de este sitio web (textos, imágenes, estructura y diseño) está protegido
            por derechos de autor. Se permite la visualización y uso personal, no comercial.
          </p>
          <p className="text-on-surface/80">
            Los datos de directorio proceden de OpenStreetMap y fuentes locales. El contenido de
            eventos, noticias y horarios de transporte procede de fuentes públicas municipales y
            de terceros asociados.
          </p>
        </section>

        {/* Limitación de responsabilidad */}
        <section>
          <h2 className="font-display text-xl font-semibold text-on-surface mb-3">
            4. Limitación de responsabilidad
          </h2>
          <p className="text-on-surface/80 mb-3">
            Este sitio web se proporciona "tal cual". Aunque se realiza un esfuerzo razonable por
            mantener la información actualizada y precisa, no se ofrece ninguna garantía sobre la
            exactitud, integridad o puntualidad de los contenidos.
          </p>
          <p className="text-on-surface/80 mb-3">
            No nos hacemos responsables de:
          </p>
          <ul className="list-disc list-inside space-y-2 text-on-surface/80">
            <li>Errores o inexactitudes en la información publicada</li>
            <li>Fallos de acceso o indisponibilidad del sitio</li>
            <li>Daños causados por malware o virus (utilizamos HTTPS, pero somos una app pequeña)</li>
            <li>Cambios en los datos de terceros (OpenStreetMap, APIs municipales, etc.)</li>
            <li>Deciciones tomadas en base a información de este sitio</li>
          </ul>
        </section>

        {/* Enlaces externos */}
        <section>
          <h2 className="font-display text-xl font-semibold text-on-surface mb-3">
            5. Enlaces a terceros
          </h2>
          <p className="text-on-surface/80">
            Este sitio puede contener enlaces a websites de terceros. No somos responsables de su
            contenido, disponibilidad o política de privacidad. Si sigues un enlace a un sitio
            externo, te recomendamos leer su propio aviso legal y política de privacidad.
          </p>
        </section>

        {/* Cambios y actualizaciones */}
        <section>
          <h2 className="font-display text-xl font-semibold text-on-surface mb-3">
            6. Cambios en este aviso
          </h2>
          <p className="text-on-surface/80">
            Nos reservamos el derecho de modificar este aviso legal en cualquier momento. Los
            cambios entrarán en vigor desde su publicación en este sitio.
          </p>
        </section>

        {/* Contacto */}
        <section>
          <h2 className="font-display text-xl font-semibold text-on-surface mb-3">
            7. Contacto
          </h2>
          <p className="text-on-surface/80 mb-2">
            Si tienes preguntas o consideraciones sobre este aviso legal, puedes escribir a:
          </p>
          <p className="text-on-surface/80">
            <a
              href="mailto:[PENDIENTE: email-de-contacto]"
              className="text-primary hover:underline"
            >
              [PENDIENTE: email-de-contacto]
            </a>
          </p>
        </section>
      </div>

      {/* Enlaces relacionados */}
      <div className="mt-12 pt-8 border-t border-outline-variant/20">
        <p className="text-sm text-on-surface/70">
          También te puede interesar:{' '}
          <Link to="/privacidad" className="text-primary hover:underline">
            Política de privacidad
          </Link>
          {' · '}
          <Link to="/cookies" className="text-primary hover:underline">
            Política de cookies
          </Link>
        </p>
      </div>
    </div>
  )
}
