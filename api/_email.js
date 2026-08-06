import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const ADMIN_EMAIL = 'danielmolino.it@gmail.com'

let resendClient = null

function obtenerResend() {
  if (!resendClient && RESEND_API_KEY) {
    resendClient = new Resend(RESEND_API_KEY)
  }
  return resendClient
}

export async function enviarEmailReclamacion({ comercioId, nombre, email, telefono, mensaje }) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurado, email no enviado')
    return { ok: true, skipped: true }
  }

  const resend = obtenerResend()
  if (!resend) {
    console.error('No se pudo inicializar Resend client')
    return { ok: false, error: 'Error al inicializar servicio de email' }
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

    const resultado = await resend.emails.send({
      from: 'noreply@naval-app.dev',
      to: ADMIN_EMAIL,
      subject: asunto,
      html: contenido,
    })

    if (resultado.error) {
      console.error('Error al enviar email con Resend:', resultado.error)
      return { ok: false, error: resultado.error }
    }

    console.log('Email enviado exitosamente:', resultado.id)
    return { ok: true, id: resultado.id }
  } catch (error) {
    console.error('Error al enviar email:', error)
    return { ok: false, error: error.message }
  }
}
