// /api/admin/destacados — solicitudes de destacado de la organización.
//   GET            — las solicitudes/destacados propios + el comercio vinculado.
//   POST           — solicita destacar un evento propio publicado o el negocio
//                    vinculado, proponiendo fecha de inicio y duración (presets
//                    de tarifasDestacados.js); siempre nace en estado
//                    'pendiente'. El superadmin puede ajustar la propuesta al
//                    aprobar; el orden es solo suyo (el pago se acuerda fuera
//                    de la app).
//   DELETE ?id=…   — retira una solicitud propia aún pendiente.
//
// La organización sale del JWT firmado, nunca de la petición. El rechazo del
// superadmin deja la fila en 'cancelado': aquí se trata como inexistente (la
// organización puede volver a solicitar, y el POST resucita esa fila).
import { obtenerSql } from '../_db.js'
import { requerirSesionEdge } from '../_auth.js'
import { organizacionDeSesion } from '../_organizacion.js'
import { json, leerJson, queryDe } from '../_http.js'
import { hoyISO, sumarDias } from '../../src/lib/fechas.js'
import { PRESETS_DURACION } from '../../src/lib/tarifasDestacados.js'

export const config = { runtime: 'edge' }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const YA_EN_CURSO = 'Ya tiene un destacado o una solicitud en curso.'

function aRespuesta(fila) {
  return {
    id: fila.id,
    tipo: fila.tipo,
    referenciaId: fila.referencia_id,
    estado: fila.estado,
    fechaInicio: fila.fecha_inicio,
    fechaFin: fila.fecha_fin,
    vigente: fila.vigente,
    imagenUrl: fila.imagen_url ?? null,
  }
}

export default async function handler(req) {
  const sesion = await requerirSesionEdge(req)
  if (sesion instanceof Response) return sesion

  try {
    const sql = obtenerSql()
    const organizacion = await organizacionDeSesion(sql, sesion.organizacionSlug)
    if (!organizacion) {
      return json({ error: 'La organización de tu cuenta ya no existe.' }, 404)
    }

    if (req.method === 'GET') return await manejarGet(sql, organizacion)
    if (req.method === 'POST') return await manejarPost(req, sql, organizacion)
    if (req.method === 'DELETE') return await manejarDelete(req, sql, organizacion)

    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/admin/destacados:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}

async function manejarGet(sql, organizacion) {
  const filas = await sql`
    SELECT id, tipo, referencia_id, estado, imagen_url,
           to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
           to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
           (estado = 'activo'
             AND fecha_inicio <= CURRENT_DATE
             AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)) AS vigente
    FROM destacados
    WHERE organizacion_id = ${organizacion.id}
    ORDER BY creado_en DESC
  `
  return json({
    comercioId: organizacion.comercio_id,
    destacados: filas.map(aRespuesta),
  })
}

async function manejarPost(req, sql, organizacion) {
  const { tipo, eventoId, imagenUrl, fechaInicio, duracionDias } = await leerJson(req)

  // La propuesta de vigencia es obligatoria y acotada: fecha de inicio no
  // pasada y duración de los presets. fecha_fin se calcula aquí (inclusiva),
  // nunca la manda el cliente.
  if (!fechaInicio || !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
    return json({ error: 'Indica la fecha de inicio propuesta.' }, 400)
  }
  if (fechaInicio < hoyISO()) {
    return json({ error: 'La fecha de inicio no puede ser pasada.' }, 400)
  }
  if (!PRESETS_DURACION.includes(duracionDias)) {
    return json({ error: 'Elige una duración válida.' }, 400)
  }
  const fechaFin = sumarDias(fechaInicio, duracionDias - 1)

  let referenciaId
  let imagen = null

  if (tipo === 'evento') {
    if (!eventoId || !UUID_REGEX.test(eventoId)) {
      return json({ error: 'Evento no válido.' }, 400)
    }
    // Solo eventos propios, publicados y con fecha por delante: destacar un
    // borrador o un evento pasado no tiene sentido en la agenda.
    const [evento] = await sql`
      SELECT id, estado, fecha_inicio >= CURRENT_DATE AS futuro
      FROM eventos_usuario
      WHERE id = ${eventoId} AND organizacion_id = ${organizacion.id}
    `
    if (!evento) return json({ error: 'Evento no encontrado.' }, 404)
    if (evento.estado !== 'publicado' || !evento.futuro) {
      return json({ error: 'Solo se pueden destacar eventos publicados con fecha futura.' }, 422)
    }
    // El formato público, el mismo que emite /api/eventos y resuelve la agenda.
    referenciaId = `bd-${eventoId}`
  } else if (tipo === 'comercio') {
    if (!organizacion.comercio_id) {
      return json({ error: 'Tu cuenta no tiene un negocio vinculado. Contacta con el equipo de la app.' }, 400)
    }
    if (!imagenUrl) {
      return json({ error: 'Un comercio destacado necesita una imagen.' }, 400)
    }
    referenciaId = organizacion.comercio_id
    imagen = imagenUrl
  } else {
    return json({ error: 'El tipo debe ser "evento" o "comercio".' }, 400)
  }

  // Una fila por item (UNIQUE tipo+referencia). Si existe una cancelada
  // (rechazo anterior o campaña cancelada) propia o sin dueño, se resucita a
  // 'pendiente' con la nueva propuesta de fechas — el orden sigue siendo del
  // superadmin.
  const [existente] = await sql`
    SELECT id, estado, organizacion_id FROM destacados
    WHERE tipo = ${tipo} AND referencia_id = ${referenciaId}
  `

  if (existente) {
    const ajeno = existente.organizacion_id && existente.organizacion_id !== organizacion.id
    if (existente.estado !== 'cancelado' || ajeno) {
      return json({ error: YA_EN_CURSO }, 409)
    }
    const [fila] = await sql`
      UPDATE destacados
      SET estado = 'pendiente',
          organizacion_id = ${organizacion.id},
          imagen_url = COALESCE(${imagen}, imagen_url),
          fecha_inicio = ${fechaInicio},
          fecha_fin = ${fechaFin}
      WHERE id = ${existente.id}
      RETURNING id, tipo, referencia_id, estado,
                to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
                to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
                false AS vigente
    `
    return json({ destacado: aRespuesta(fila) }, 201)
  }

  // Sin transacción entre sentencias (driver HTTP de Neon), dos clics
  // simultáneos podrían pasar ambos el SELECT: la constraint decide y aquí
  // solo se traduce a un 409 en vez de un 500.
  let filas
  try {
    filas = await sql`
      INSERT INTO destacados (tipo, referencia_id, organizacion_id, imagen_url, estado, fecha_inicio, fecha_fin)
      VALUES (${tipo}, ${referenciaId}, ${organizacion.id}, ${imagen}, 'pendiente', ${fechaInicio}, ${fechaFin})
      RETURNING id, tipo, referencia_id, estado,
                to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
                to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
                false AS vigente
    `
  } catch (error) {
    if (error?.code === '23505') return json({ error: YA_EN_CURSO }, 409)
    throw error
  }

  return json({ destacado: aRespuesta(filas[0]) }, 201)
}

async function manejarDelete(req, sql, organizacion) {
  const { id } = queryDe(req)
  if (!id || !UUID_REGEX.test(id)) return json({ error: 'ID inválido.' }, 400)

  // Solo solicitudes propias aún pendientes: un destacado activo (contratado)
  // lo gestiona el superadmin.
  const filas = await sql`
    DELETE FROM destacados
    WHERE id = ${id} AND organizacion_id = ${organizacion.id} AND estado = 'pendiente'
    RETURNING id
  `
  if (filas.length === 0) return json({ error: 'Solicitud no encontrada o ya gestionada.' }, 404)
  return json({ eliminado: true })
}
