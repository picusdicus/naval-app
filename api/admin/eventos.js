// /api/admin/eventos
//   GET            — todos los eventos de la organización (borradores incluidos).
//   GET    ?id=…   — un evento suelto, para prerrellenar el formulario de edición.
//   POST           — crea un evento.
//   PUT    ?id=…   — reemplaza todos los campos de un evento.
//   PATCH  ?id=…   — cambia solo el estado (borrador ⇄ publicado).
//   DELETE ?id=…   — lo elimina.
//
// La organización sale del JWT firmado, nunca de la petición, y todas las
// consultas filtran por `organizacion_id`: nadie puede leer, editar ni borrar
// eventos de otra organización cambiando un parámetro.
import { obtenerSql } from '../_db.js'
import { requerirSesionEdge } from '../_auth.js'
import { json, leerJson } from '../_http.js'
import { validarEvento, normalizarEvento, ESTADOS_EVENTO } from '../../src/lib/eventoForm.js'

export const config = { runtime: 'edge' }

const hoyISO = () => new Date().toISOString().slice(0, 10)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Nota: `fecha_inicio` se formatea con to_char en cada consulta. El driver
// devuelve las columnas `date` como objetos Date, y convertirlas en JS
// arrastra la zona horaria.
const aEvento = (e) => ({
  id: e.id,
  titulo: e.titulo,
  descripcion: e.descripcion,
  categoria: e.categoria,
  lugar: e.lugar,
  fecha: e.fecha,
  hora: e.hora,
  horaFin: e.hora_fin,
  imagen: e.imagen_url,
  entradasTexto: e.entradas_texto,
  entradasUrl: e.entradas_url,
  precio: e.precio,
  estado: e.estado,
})

async function organizacionDeSesion(sql, slug) {
  const [organizacion] = await sql`
    SELECT id, nombre, slug, categoria_defecto, lugar_defecto
    FROM organizaciones WHERE slug = ${slug}
  `
  return organizacion ?? null
}

/**
 * La categoría y el lugar los fija el perfil de la organización, no el gestor:
 * en el formulario son de solo lectura, y aquí se imponen aunque el cliente
 * envíe otra cosa. Si el perfil aún no los tiene, se respeta lo recibido.
 */
function conPerfilDeLaOrganizacion(cuerpo, organizacion) {
  return {
    ...cuerpo,
    categoria: organizacion.categoria_defecto ?? cuerpo?.categoria,
    lugar: organizacion.lugar_defecto ?? cuerpo?.lugar,
  }
}

async function listar(sql, organizacion) {
  const filas = await sql`
    SELECT id, titulo, descripcion, categoria, lugar,
           to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha, hora, hora_fin,
           imagen_url, entradas_texto, entradas_url, precio, estado
    FROM eventos_usuario
    WHERE organizacion_id = ${organizacion.id}
    ORDER BY fecha_inicio DESC, creado_en DESC
  `

  const hoy = hoyISO()
  const eventos = filas.map(aEvento)

  return json({
    organizacion: { nombre: organizacion.nombre, slug: organizacion.slug },
    eventos,
    resumen: {
      total: eventos.length,
      publicados: eventos.filter((e) => e.estado === 'publicado').length,
      borradores: eventos.filter((e) => e.estado === 'borrador').length,
      proximos: eventos.filter((e) => e.fecha >= hoy).length,
      pasados: eventos.filter((e) => e.fecha < hoy).length,
    },
  })
}

async function obtenerUno(sql, organizacion, id) {
  const [fila] = await sql`
    SELECT id, titulo, descripcion, categoria, lugar,
           to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha, hora, hora_fin,
           imagen_url, entradas_texto, entradas_url, precio, estado
    FROM eventos_usuario
    WHERE id = ${id} AND organizacion_id = ${organizacion.id}
  `
  if (!fila) return json({ error: 'Ese evento no existe.' }, 404)
  return json({ evento: aEvento(fila) })
}

async function crear(sql, organizacion, cuerpoRecibido) {
  const cuerpo = conPerfilDeLaOrganizacion(cuerpoRecibido, organizacion)

  // No nos fiamos del cliente: se revalida con las mismas reglas del formulario.
  const errores = validarEvento(cuerpo)
  if (Object.keys(errores).length > 0) {
    return json({ error: 'Revisa los campos del formulario.', errores }, 422)
  }

  const e = normalizarEvento(cuerpo)

  const [creado] = await sql`
    INSERT INTO eventos_usuario (
      organizacion_id, titulo, descripcion, categoria, lugar,
      fecha_inicio, hora, hora_fin, imagen_url,
      entradas_texto, entradas_url, precio, estado
    ) VALUES (
      ${organizacion.id}, ${e.titulo}, ${e.descripcion}, ${e.categoria}, ${e.lugar},
      ${e.fecha}, ${e.hora}, ${e.horaFin}, ${e.imagen},
      ${e.entradasTexto}, ${e.entradasUrl}, ${e.precio}, ${e.estado}
    )
    RETURNING id, titulo, estado
  `

  return json({ evento: creado }, 201)
}

async function actualizar(sql, organizacion, id, cuerpoRecibido) {
  const cuerpo = conPerfilDeLaOrganizacion(cuerpoRecibido, organizacion)

  const errores = validarEvento(cuerpo)
  if (Object.keys(errores).length > 0) {
    return json({ error: 'Revisa los campos del formulario.', errores }, 422)
  }

  const e = normalizarEvento(cuerpo)

  const [actualizado] = await sql`
    UPDATE eventos_usuario SET
      titulo = ${e.titulo}, descripcion = ${e.descripcion}, categoria = ${e.categoria},
      lugar = ${e.lugar}, fecha_inicio = ${e.fecha}, hora = ${e.hora}, hora_fin = ${e.horaFin},
      imagen_url = ${e.imagen}, entradas_texto = ${e.entradasTexto},
      entradas_url = ${e.entradasUrl}, precio = ${e.precio}, estado = ${e.estado},
      actualizado_en = now()
    WHERE id = ${id} AND organizacion_id = ${organizacion.id}
    RETURNING id, titulo, estado
  `

  if (!actualizado) return json({ error: 'Ese evento no existe.' }, 404)
  return json({ evento: actualizado })
}

async function cambiarEstado(sql, organizacion, id, cuerpoRecibido) {
  const { estado } = cuerpoRecibido
  if (!ESTADOS_EVENTO.includes(estado)) {
    return json({ error: 'Estado no válido.' }, 422)
  }

  const [actualizado] = await sql`
    UPDATE eventos_usuario
    SET estado = ${estado}, actualizado_en = now()
    WHERE id = ${id} AND organizacion_id = ${organizacion.id}
    RETURNING id, titulo, estado
  `

  if (!actualizado) return json({ error: 'Ese evento no existe.' }, 404)
  return json({ evento: actualizado })
}

async function eliminar(sql, organizacion, id) {
  const [borrado] = await sql`
    DELETE FROM eventos_usuario
    WHERE id = ${id} AND organizacion_id = ${organizacion.id}
    RETURNING id, titulo
  `

  if (!borrado) return json({ error: 'Ese evento no existe.' }, 404)
  return json({ evento: borrado })
}

const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const METODOS_CON_CUERPO = ['POST', 'PUT', 'PATCH']

export default async function handler(req) {
  if (!METODOS.includes(req.method)) {
    return json({ error: 'Método no permitido' }, 405)
  }

  const sesion = await requerirSesionEdge(req)
  if (sesion instanceof Response) return sesion

  const id = new URL(req.url).searchParams.get('id')
  const necesitaId = req.method !== 'GET' && req.method !== 'POST'

  // Un id con otra forma nunca existirá: cortamos antes de tocar la base de
  // datos, que rechazaría el uuid inválido con un error de tipo.
  if ((necesitaId || id) && !UUID.test(String(id ?? ''))) {
    return json({ error: 'Ese evento no existe.' }, necesitaId ? 400 : 404)
  }

  const cuerpo = METODOS_CON_CUERPO.includes(req.method) ? await leerJson(req) : {}

  try {
    const sql = obtenerSql()
    const organizacion = await organizacionDeSesion(sql, sesion.organizacionSlug)
    if (!organizacion) {
      return json({ error: 'La organización de tu cuenta ya no existe.' }, 404)
    }

    switch (req.method) {
      case 'POST':
        return await crear(sql, organizacion, cuerpo)
      case 'PUT':
        return await actualizar(sql, organizacion, id, cuerpo)
      case 'PATCH':
        return await cambiarEstado(sql, organizacion, id, cuerpo)
      case 'DELETE':
        return await eliminar(sql, organizacion, id)
      default:
        return id
          ? await obtenerUno(sql, organizacion, id)
          : await listar(sql, organizacion)
    }
  } catch (error) {
    console.error('Fallo en /api/admin/eventos:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}
