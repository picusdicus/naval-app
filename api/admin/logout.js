// POST /api/admin/logout — caduca la cookie de sesión.
import { cookieDeBorrado } from '../_auth.js'
import { json, csrfInvalido, rechazoCsrf } from '../_http.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }
  if (csrfInvalido(req)) return rechazoCsrf()

  return json({ ok: true }, 200, { 'Set-Cookie': cookieDeBorrado() })
}
