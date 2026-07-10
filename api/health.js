// GET /api/health — comprueba que la función serverless alcanza Neon Postgres
// y que el esquema inicial está presente. No expone credenciales.
import { obtenerSql, TABLAS } from './_db.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const inicio = Date.now()

  try {
    const sql = obtenerSql()

    const [{ ahora }] = await sql`SELECT now() AS ahora`

    const filas = await sql`
      SELECT table_name AS tabla
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY(${TABLAS})
    `
    const encontradas = filas.map((f) => f.tabla)
    const faltan = TABLAS.filter((t) => !encontradas.includes(t))

    return res.status(faltan.length ? 503 : 200).json({
      ok: faltan.length === 0,
      baseDatos: 'conectada',
      hora: ahora,
      esquema: faltan.length ? 'incompleto' : 'ok',
      tablas: encontradas.sort(),
      faltan,
      latenciaMs: Date.now() - inicio,
    })
  } catch (error) {
    console.error('Health check falló:', error)
    return res.status(503).json({
      ok: false,
      baseDatos: 'desconectada',
      error: error.message,
      latenciaMs: Date.now() - inicio,
    })
  }
}
