const RESEND_API_KEY = process.env.RESEND_API_KEY
const ADMIN_EMAIL = 'danielmolino@gmail.com'
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

export async function enviarEmailReclamacion({ comercioId, nombre, email, telefono, mensaje }) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurado, email no enviado')
    return { ok: true, skipped: true }
  }

  try {
    const asunto = `Nueva solicitud de reclamación: ${comercioId}`
    const contenido = `
      <h2>Nueva Solicitud de Reclamación de Comercio</h2>
      <p><strong>Comercio ID:</strong> ${comercioId}</p>
      <p><strong>Nombre del reclamante:</strong> ${nombre}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Teléfono:</strong> ${telefono || 'No proporcionado'}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${mensaje}</p>
      <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
    `

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: ADMIN_EMAIL,
        subject: asunto,
        html: contenido,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error al enviar email con Resend:', error)
      return { ok: false, error: error }
    }

    const resultado = await response.json()
    console.log('Email enviado exitosamente:', resultado.id)
    return { ok: true, id: resultado.id }
  } catch (error) {
    console.error('Error al enviar email:', error.message)
    return { ok: false, error: error.message }
  }
}
