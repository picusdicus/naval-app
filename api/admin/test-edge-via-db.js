// Endpoint de prueba que IMPORTA desde _db.js (como eventos.js, login.js, etc.)
// para ver si el problema está en cómo _db.js re-exporta

import { obtenerSql } from '../_db.js'

export const config = { runtime: 'edge' }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const sql = obtenerSql()
    const resultado = await sql`SELECT 1 as test`

    return res.status(200).json({
      ok: true,
      message: 'Via _db.js: Neon client initialized successfully',
      result: resultado,
    })
  } catch (error) {
    console.error('Error en test-edge-via-db:', error)
    return res.status(500).json({
      error: error.message,
      type: error.constructor.name,
    })
  }
}
