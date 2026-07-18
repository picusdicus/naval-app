// Candado del portal vecinal, verificado en SERVIDOR.
//
// Antes la contraseña se comparaba en el cliente contra VITE_APP_PASSWORD (que
// viaja en el bundle) y la "sesión" era un flag en localStorage: ambos triviales
// de saltar. Ahora la contraseña vive solo en el servidor (APP_ACCESO_PASSWORD,
// sin prefijo VITE_) y el acceso se guarda en una cookie httpOnly firmada.
//
//   POST   /api/acceso  { password }  → valida y abre el candado (cookie de portal)
//   GET    /api/acceso                 → ¿cookie de portal válida? (arranque del frontend)
//   DELETE /api/acceso                 → cierra el candado (logout del portal)
import {
  igualSeguro,
  firmarToken,
  cookieDePortal,
  cookieDeBorradoPortal,
  verificarSesionPortal,
} from './_auth.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from './_http.js'
import { limitar, obtenerIp, respuesta429 } from './_ratelimit.js'

export const config = { runtime: 'edge' }

const DURACION_PORTAL_S = 30 * 24 * 60 * 60

export default async function handler(req) {
  if (csrfInvalido(req)) return rechazoCsrf()

  if (req.method === 'GET') {
    const sesion = await verificarSesionPortal(req)
    return sesion ? json({ ok: true }) : json({ ok: false }, 401)
  }

  if (req.method === 'DELETE') {
    return json({ ok: true }, 200, { 'Set-Cookie': cookieDeBorradoPortal() })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  // Rate-limit por IP: sin él, el candado sería fuerza-bruteable igual que antes.
  const limite = await limitar({ clave: `acceso:ip:${obtenerIp(req)}`, limite: 10, ventanaS: 15 * 60 })
  if (!limite.ok) return respuesta429(limite.resetEnS)

  const esperada = process.env.APP_ACCESO_PASSWORD
  if (!esperada) {
    // Fallar cerrado: sin contraseña configurada, nadie entra.
    console.error('Falta APP_ACCESO_PASSWORD en el entorno.')
    return json({ error: 'El acceso no está configurado en el servidor.' }, 500)
  }

  const { password } = await leerJson(req)
  if (!password) {
    return json({ error: 'Introduce la contraseña.' }, 400)
  }

  if (!(await igualSeguro(String(password), esperada))) {
    return json({ error: 'Contraseña incorrecta' }, 401)
  }

  const token = await firmarToken({ rol: 'vecino' }, DURACION_PORTAL_S)
  return json({ ok: true }, 200, { 'Set-Cookie': cookieDePortal(token) })
}
