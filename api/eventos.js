// GET /api/eventos — eventos publicados por las organizaciones, para la agenda
// pública. Solo salen los que están en estado 'publicado': los borradores
// nunca abandonan el panel /admin.
//
// Se devuelven con la misma forma que los eventos de src/data/eventos*.json,
// para que el frontend pueda mezclarlos sin adaptadores.
//
// Edge Function: el driver HTTP de Neon (`neon()`) va sobre fetch, así que no
// hace falta el runtime de Node y no consume una de las 12 Serverless Functions.
export const config = { runtime: 'edge' }

import { obtenerSql } from './_db.js'

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const sql = obtenerSql()

    // `fecha_inicio` se formatea en SQL: el driver devuelve las columnas `date`
    // como objetos Date, y convertirlas en JS arrastra la zona horaria.
    const filas = await sql`
      SELECT e.id, e.titulo, e.descripcion, e.categoria, e.subcategoria, e.lugar,
             to_char(e.fecha_inicio, 'YYYY-MM-DD') AS fecha,
             e.hora, e.hora_fin, e.imagen_url,
             e.entradas_texto, e.entradas_url, e.precio,
             e.organizacion_id, o.nombre AS organizacion, o.slug AS organizacion_slug
      FROM eventos_usuario e
      JOIN organizaciones o ON o.id = e.organizacion_id
      WHERE e.estado = 'publicado' AND o.activa = true
      ORDER BY e.fecha_inicio ASC
    `

    const eventos = filas.map((e) => ({
      // El prefijo evita chocar con los ids de los JSON ('ev-…', 'aytocult-…').
      id: `bd-${e.id}`,
      titulo: e.titulo,
      descripcion: e.descripcion,
      categoria: e.categoria,
      subcategoria: e.subcategoria || null,
      lugar: e.lugar,
      fecha: e.fecha,
      hora: e.hora,
      horaFin: e.hora_fin,
      imagen: e.imagen_url || '',
      origen: 'cultural',
      fuente: e.organizacion,
      // Para que la página de detalle pueda atribuir la visita a su dueña.
      organizacionId: e.organizacion_id,
      // Para el matcher aproximado de la agenda (solo Ayuntamiento, ver
      // SLUG_AYUNTAMIENTO en src/lib/dedupEventos.js). El slug es estable;
      // el nombre de la org puede cambiar.
      organizacionSlug: e.organizacion_slug,
      entradas: e.entradas_url
        ? { texto: e.entradas_texto, url: e.entradas_url, precio: e.precio }
        : null,
    }))

    return new Response(JSON.stringify({ eventos }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache corta en el CDN: la agenda no necesita ser instantánea, pero un
        // evento recién publicado debe aparecer en menos de un minuto.
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    // La agenda pública debe seguir mostrando los eventos del JSON aunque la
    // base de datos no responda.
    console.error('No se pudieron leer los eventos publicados:', error)
    return new Response(
      JSON.stringify({ eventos: [], error: 'base-de-datos-no-disponible' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
