const RESEND_API_KEY = process.env.RESEND_API_KEY
const ADMIN_EMAIL = 'danielmolino.it@gmail.com'

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
