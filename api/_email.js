const RESEND_API_KEY = process.env.RESEND_API_KEY
const ADMIN_EMAIL = 'danielmolino@gmail.com'
const RESEND_FROM = 'En Navalcarnero <noreply@ennavalcarnero.es>'

// Interruptor para los e2e. Los tests atacan servicios reales a propósito y
// limpian lo que crean en Neon y en Blob, pero un email enviado no se puede
// deshacer: `validar rate-limiting en reclamaciones` manda 6 solicitudes de
// las que 5 se aceptan, y cada una dispara DOS correos (aviso y confirmación)
// — 20 por pasada contando los dos viewports, contra la cuota de Resend.
// playwright.config.js lo pone en el entorno del servidor de desarrollo.
const SIN_EMAIL = process.env.E2E_SIN_EMAIL === '1'
const APP_URL = process.env.APP_URL || 'https://naval-app-one.vercel.app'

/**
 * Aviso al superadmin de que un run de sincronización dejó eventos/actividades
 * en borrador pendientes de validar en /admin → Pendientes. Fail-soft, como
 * el email de reclamaciones: sin RESEND_API_KEY o con error, solo se loguea.
 * `origen` es la frase que explica de qué vía vienen los borradores (cada
 * llamador pasa la suya); los items solo necesitan `titulo` y opcional `fecha`.
 */
export async function enviarEmailPendientes({
  eventos = [],
  actividades = [],
  origen = 'Una sincronización automática ha dejado contenido en borrador:',
}) {
  if (SIN_EMAIL) {
    console.warn('E2E_SIN_EMAIL=1: email de pendientes NO enviado')
    return { ok: true, skipped: true }
  }
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurado, email de pendientes no enviado')
    return { ok: true, skipped: true }
  }

  const total = eventos.length + actividades.length
  const lista = (items) =>
    items
      .map((i) => `<li>${i.titulo}${i.fecha ? ` <span style="color:#777">(${i.fecha})</span>` : ''}</li>`)
      .join('')

  try {
    const contenido = `
      <h2>Hay ${total} ${total === 1 ? 'elemento pendiente' : 'elementos pendientes'} de validar</h2>
      <p>${origen}</p>
      ${eventos.length ? `<h3>Eventos (${eventos.length})</h3><ul>${lista(eventos)}</ul>` : ''}
      ${actividades.length ? `<h3>Actividades (${actividades.length})</h3><ul>${lista(actividades)}</ul>` : ''}
      <p><a href="${APP_URL}/admin" style="background: #b0472f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Revisar en el panel</a></p>
      <p style="color:#777">Nada de esto es visible en la app hasta que lo publiques; lo que descartes queda archivado y no volverá a aparecer aunque se repita la sincronización.</p>
    `

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'En Navalcarnero <noreply@ennavalcarnero.es>',
        to: ADMIN_EMAIL,
        subject: `${total} ${total === 1 ? 'pendiente' : 'pendientes'} de validar en la agenda`,
        html: contenido,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error al enviar email de pendientes con Resend:', error)
      return { ok: false, error }
    }
    const resultado = await response.json()
    return { ok: true, id: resultado.id }
  } catch (error) {
    console.error('Error al enviar email de pendientes:', error.message)
    return { ok: false, error: error.message }
  }
}

/**
 * Avisa de una solicitud de reclamación de comercio: un correo al superadmin
 * con los datos y otro de confirmación al solicitante. Vivía duplicada dentro
 * de api/solicitar-reclamacion.js, que la llamaba sin pasar por este módulo y
 * por tanto sin la guarda SIN_EMAIL — ver el comentario de arriba.
 * Fail-soft como el resto: cualquier error se loguea y se devuelve, nunca se
 * lanza (una solicitud guardada no se tira por no haber podido avisar).
 */
export async function enviarEmailReclamacion({
  solicitudId,
  comercioId,
  nombre,
  email,
  telefono,
  mensaje,
  createdAt,
}) {
  if (SIN_EMAIL) {
    console.warn('E2E_SIN_EMAIL=1: email de reclamación NO enviado')
    return { ok: true, skipped: true }
  }
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurado, email no enviado')
    return { ok: true, skipped: true }
  }

  try {
    const fechaFormato = new Date(createdAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })

    // Email al admin
    const asuntoAdmin = `Nueva solicitud de reclamación: ${comercioId} [${solicitudId.substring(0, 8)}]`
    const contenidoAdmin = `
      <h2>Nueva Solicitud de Reclamación de Comercio</h2>
      <p><strong>ID de Solicitud:</strong> ${solicitudId}</p>
      <p><strong>Comercio ID:</strong> ${comercioId}</p>
      <p><strong>Nombre del reclamante:</strong> ${nombre}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Teléfono:</strong> ${telefono || 'No proporcionado'}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${mensaje}</p>
      <p><strong>Fecha de solicitud:</strong> ${fechaFormato}</p>
    `

    const responseAdmin = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: ADMIN_EMAIL,
        subject: asuntoAdmin,
        html: contenidoAdmin,
      }),
    })

    if (!responseAdmin.ok) {
      const error = await responseAdmin.text()
      console.error('Error al enviar email al admin con Resend:', error)
      return { ok: false, error: error }
    }

    // Email al solicitante
    const asuntoSolicitante = `Tu solicitud de reclamación ha sido recibida [${solicitudId.substring(0, 8)}]`
    const contenidoSolicitante = `
      <h2>Confirmación de Solicitud de Reclamación</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu solicitud de reclamación para el comercio <strong>${comercioId}</strong> ha sido recibida correctamente.</p>
      <p><strong>ID de Solicitud:</strong> <code>${solicitudId}</code></p>
      <p>Por favor, guarda este ID para poder hacer seguimiento de tu solicitud. Te contactaremos en breve para verificar tu identidad.</p>
      <hr style="border:none; border-top:1px solid #ddd; margin: 20px 0;">
      <p style="color:#666; font-size:12px;">
        Fecha de solicitud: ${fechaFormato}<br>
        Este es un email automático, por favor no respondas.
      </p>
    `

    // En desarrollo, enviar a danielmolino@gmail.com (único email verificado en Resend)
    const esProduccion = process.env.NODE_ENV === 'production'
    const emailDestino = esProduccion ? email : ADMIN_EMAIL
    const asuntoConMarca = esProduccion ? asuntoSolicitante : `${asuntoSolicitante} [TEST: ${email}]`

    const responseSolicitante = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: emailDestino,
        subject: asuntoConMarca,
        html: contenidoSolicitante,
      }),
    })

    if (!responseSolicitante.ok) {
      const error = await responseSolicitante.text()
      console.error('Error al enviar email al solicitante con Resend:', error)
      return { ok: false, error: error }
    }

    console.log(`Emails enviados exitosamente${!esProduccion ? ` (confirmación enviada a ${emailDestino}, original: ${email})` : ''}`)
    return { ok: true }
  } catch (error) {
    console.error('Error al enviar emails:', error.message)
    return { ok: false, error: error.message }
  }
}
