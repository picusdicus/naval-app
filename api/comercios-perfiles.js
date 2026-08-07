// GET /api/comercios-perfiles — todos los perfiles enriquecidos de golpe.
//
// El listado de comercios pinta foto, sello "verificado" y descripción de cada
// ficha reclamada, así que necesita los perfiles de la categoría entera. Pedirlos
// uno a uno (/api/comercio-perfil?id=) eran cientos de peticiones por visita;
// esto es una sola respuesta cacheable en CDN.
//
// Solo columnas de listado (nada de horarios/fotos/redes): la ficha completa la
// sigue sirviendo /api/comercio-perfil.
import { obtenerSql } from './_db.js'
import { json } from './_http.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Método no permitido' }, 405)
  }

  try {
    const sql = obtenerSql()
    const filas = await sql`
      SELECT comercio_id, descripcion, foto_principal, telefono, direccion
      FROM comercios_perfil
    `

    // Mapa comercio_id → perfil: la UI resuelve por id sin recorrer el array.
    const perfiles = {}
    for (const fila of filas) perfiles[fila.comercio_id] = fila

    return new Response(JSON.stringify({ perfiles }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('[comercios-perfiles] Error:', error)
    // Falla abierto: sin perfiles el listado sigue funcionando con el JSON.
    return json({ perfiles: {} }, 200)
  }
}
