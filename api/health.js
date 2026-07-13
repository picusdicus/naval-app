// GET /api/health — comprueba que la función alcanza Neon Postgres y que el
// esquema inicial está presente. No expone credenciales.
//
// Edge Function: el driver HTTP de Neon va sobre fetch (ver api/eventos.js).
export const config = { runtime: 'edge' }

import { obtenerSql, TABLAS } from './_db.js'

const json = (datos, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
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

    return json(
      {
        ok: faltan.length === 0,
        baseDatos: 'conectada',
        hora: ahora,
        esquema: faltan.length ? 'incompleto' : 'ok',
        tablas: encontradas.sort(),
        faltan,
        latenciaMs: Date.now() - inicio,
      },
      faltan.length ? 503 : 200
    )
  } catch (error) {
    console.error('Health check falló:', error)
    return json(
      {
        ok: false,
        baseDatos: 'desconectada',
        error: error.message,
        latenciaMs: Date.now() - inicio,
      },
      503
    )
  }
}
