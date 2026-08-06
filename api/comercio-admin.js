// GET /api/comercio-admin?id=...
// Verifica si el usuario actual (si está logueado) es admin de la organización vinculada a un comercio
import { obtenerSql } from './_db.js'
import { requerirSesionEdge } from './_auth.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 })
  }

  const url = new URL(req.url)
  const comercioId = url.searchParams.get('id')

  if (!comercioId) {
    return new Response(JSON.stringify({ error: 'ID de comercio requerido' }), { status: 400 })
  }

  try {
    // Verificar si el usuario está logueado
    const sesion = await requerirSesionEdge(req)

    // Si no hay sesión (usuario no logueado), retornar false
    if (sesion instanceof Response) {
      return new Response(
        JSON.stringify({ esAdmin: false, orgId: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const sql = obtenerSql()

    // Buscar la organización vinculada al comercio
    const [org] = await sql`
      SELECT id
      FROM organizaciones
      WHERE comercio_id = ${comercioId}
      LIMIT 1
    `

    if (!org) {
      return new Response(
        JSON.stringify({ esAdmin: false, orgId: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verificar si el usuario actual es admin/editor de esa organización
    const [usuario] = await sql`
      SELECT id, rol
      FROM usuarios
      WHERE organizacion_id = ${org.id}
      AND id = ${sesion.usuarioId}
      LIMIT 1
    `

    const esAdmin = usuario && (usuario.rol === 'admin' || usuario.rol === 'editor')

    return new Response(
      JSON.stringify({
        esAdmin,
        orgId: org.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[comercio-admin] Error:', error)
    // En caso de error, retornar false (no es admin)
    return new Response(
      JSON.stringify({ esAdmin: false, orgId: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
