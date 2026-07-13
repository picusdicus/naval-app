// Endpoint de prueba minimal para verificar si @neondatabase/serverless
// es realmente compatible con Edge Runtime de Vercel.
// NO importa _db.js, NO importa _auth.js, SOLO neon directo.

import { neon } from '@neondatabase/serverless'

export const config = { runtime: 'edge' }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const url = process.env.DATABASE_URL
    if (!url) {
      return res.status(500).json({ error: 'DATABASE_URL not configured' })
    }

    // Instanciar neon directamente, mismo patrón que en _db.js
    const sql = neon(url)

    // Query trivial
    const resultado = await sql`SELECT 1 as test`

    return res.status(200).json({
      ok: true,
      message: 'Neon client initialized and executed query successfully in Edge Runtime',
      result: resultado,
    })
  } catch (error) {
    console.error('Error en test-edge-db:', error)
    return res.status(500).json({
      error: error.message,
      type: error.constructor.name,
    })
  }
}
