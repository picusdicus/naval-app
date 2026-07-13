// POST /api/admin/logout — caduca la cookie de sesión.
import { borrarCookieSesion } from '../_auth.js'

export const config = { runtime: 'edge' }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  borrarCookieSesion(res)
  return res.status(200).json({ ok: true })
}
