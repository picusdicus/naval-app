// POST /api/admin/login — { email, password } → cookie httpOnly con el JWT.
import { credencialesValidas, firmarToken, establecerCookieSesion, usuarioDeEntorno } from '../_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Introduce tu email y tu contraseña.' })
  }

  let acertadas
  try {
    acertadas = credencialesValidas(email, password)
  } catch (error) {
    // Faltan ADMIN_EMAIL/ADMIN_PASSWORD: es un fallo de configuración, no del
    // usuario. El motivo se queda en los logs del servidor.
    console.error('Login mal configurado:', error.message)
    return res.status(500).json({ error: 'El acceso no está configurado en el servidor.' })
  }

  // Mismo mensaje para email y contraseña: no revelamos cuál de los dos falló.
  if (!acertadas) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos.' })
  }

  const usuario = usuarioDeEntorno()
  try {
    establecerCookieSesion(res, firmarToken(usuario))
  } catch (error) {
    // Falta ADMIN_JWT_SECRET: sin secreto no podemos emitir la sesión.
    console.error('Login mal configurado:', error.message)
    return res.status(500).json({ error: 'El acceso no está configurado en el servidor.' })
  }

  return res.status(200).json({ usuario })
}
