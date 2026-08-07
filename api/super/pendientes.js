// /api/super/pendientes — validación de lo extraído automáticamente de
// programaciones enlazadas (PDF de agenda, galerías HTML) por el webhook
// api/sync-instagram-noticias.js, que lo deja en estado 'borrador':
//   GET                     — lista eventos y actividades pendientes
//   PATCH  ?tipo=…&id=…     — publica (estado 'publicado')
//   DELETE ?tipo=…&id=…     — descarta (estado 'archivado', NO borra: el
//                             upsert del webhook no toca `estado`, así que un
//                             descartado no resucita al re-sincronizar)
// Solo superadmin. Solo alcanza filas auto-sincronizadas (origen_externo_id
// IS NOT NULL en eventos): los borradores de las organizaciones en su panel
// quedan fuera del alcance de este endpoint.
import { obtenerSql } from '../_db.js'
import { requerirSuperAdminEdge } from '../_auth.js'
import { json, csrfInvalido, rechazoCsrf } from '../_http.js'

export const config = { runtime: 'edge' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function listar(sql) {
  const eventos = await sql`
    SELECT id, titulo, descripcion, categoria, hora, lugar, url, imagen_url,
           origen_externo_id,
           to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha
    FROM eventos_usuario
    WHERE estado = 'borrador' AND origen_externo_id IS NOT NULL
    ORDER BY fecha_inicio ASC`
  const actividades = await sql`
    SELECT id, titulo, descripcion, categoria, horario, lugar, url_fuente, imagen_url,
           origen_externo_id,
           to_char(fecha_limite, 'YYYY-MM-DD') AS fecha_limite
    FROM actividades
    WHERE estado = 'borrador'
    ORDER BY fecha_limite ASC NULLS LAST`
  return json({
    eventos: eventos.map((e) => ({
      id: e.id,
      titulo: e.titulo,
      descripcion: e.descripcion,
      categoria: e.categoria,
      fecha: e.fecha,
      hora: e.hora,
      lugar: e.lugar,
      url: e.url,
      imagen: e.imagen_url,
      origen: e.origen_externo_id,
    })),
    actividades: actividades.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      descripcion: a.descripcion,
      categoria: a.categoria,
      fechaLimite: a.fecha_limite,
      horario: a.horario,
      lugar: a.lugar,
      url: a.url_fuente,
      imagen: a.imagen_url,
      origen: a.origen_externo_id,
    })),
  })
}

/** Cambia el estado de un borrador (publicar o archivar). */
async function resolver(sql, tipo, id, estado) {
  const filas =
    tipo === 'evento'
      ? await sql`
          UPDATE eventos_usuario SET estado = ${estado}, actualizado_en = now()
          WHERE id = ${id} AND estado = 'borrador' AND origen_externo_id IS NOT NULL
          RETURNING id`
      : await sql`
          UPDATE actividades SET estado = ${estado}, actualizado_en = now()
          WHERE id = ${id} AND estado = 'borrador'
          RETURNING id`
  if (!filas.length) {
    return json({ error: 'No hay ningún borrador pendiente con ese id.' }, 404)
  }
  return json({ ok: true })
}

export default async function handler(req) {
  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  try {
    const sql = obtenerSql()

    if (req.method === 'GET') return await listar(sql)

    if (req.method === 'PATCH' || req.method === 'DELETE') {
      if (csrfInvalido(req)) return rechazoCsrf()
      const url = new URL(req.url)
      const tipo = url.searchParams.get('tipo')
      const id = url.searchParams.get('id')
      if (!['evento', 'actividad'].includes(tipo) || !id || !UUID.test(id)) {
        return json({ error: 'Parámetros no válidos: tipo (evento|actividad) e id (uuid).' }, 400)
      }
      return await resolver(sql, tipo, id, req.method === 'PATCH' ? 'publicado' : 'archivado')
    }

    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/super/pendientes:', error)
    return json({ error: 'Error en el servidor.' }, 500)
  }
}
