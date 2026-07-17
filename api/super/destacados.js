// GET /api/super/destacados — lista todos los destacados (también los no vigentes)
// POST /api/super/destacados — da de alta un destacado (reutiliza la fila si el item ya estuvo destacado)
// PUT /api/super/destacados?id=… — actualiza orden, vigencia, imagen u organización
// PATCH /api/super/destacados?id=… — cambia solo el estado
// DELETE /api/super/destacados?id=… — elimina el destacado
import { requerirSuperAdminEdge } from '../_auth.js'
import { obtenerSql } from '../_db.js'
import { json, leerJson, queryDe } from '../_http.js'

export const config = { runtime: 'edge' }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIPOS = ['evento', 'comercio']
const ESTADOS = ['pendiente', 'activo', 'cancelado']

// Las fechas se formatean en SQL: el driver de Neon convierte `date` en Date
// de JS y arrastra la zona horaria. `vigente` aplica el mismo criterio que el
// GET público /api/destacados.
function aRespuesta(fila) {
  return {
    id: fila.id,
    tipo: fila.tipo,
    referenciaId: fila.referencia_id,
    organizacionId: fila.organizacion_id,
    organizacionNombre: fila.organizacion_nombre ?? null,
    orden: fila.orden,
    imagenUrl: fila.imagen_url,
    fechaInicio: fila.fecha_inicio,
    fechaFin: fila.fecha_fin,
    estado: fila.estado,
    vigente: fila.vigente,
    creadoEn: fila.creado_en,
  }
}

/** Valida el cuerpo común de POST/PUT. Devuelve un mensaje de error o null. */
function validar({ tipo, referenciaId, organizacionId, imagenUrl, fechaInicio, fechaFin, estado }) {
  if (!TIPOS.includes(tipo)) return 'El tipo debe ser "evento" o "comercio".'
  if (!referenciaId || typeof referenciaId !== 'string' || !referenciaId.trim()) {
    return 'Falta la referencia del evento o comercio.'
  }
  // Los comercios del directorio no tienen foto propia: destacar uno exige
  // aportarla (la tarjeta a sangre completa la necesita).
  if (tipo === 'comercio' && !imagenUrl) return 'Un comercio destacado necesita una imagen.'
  if (organizacionId && !UUID_REGEX.test(organizacionId)) return 'Organización inválida.'
  if (estado !== undefined && !ESTADOS.includes(estado)) return 'Estado no válido.'
  if (fechaInicio && !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) return 'Fecha de inicio inválida.'
  // La duración es obligatoria: un destacado es una campaña con fin. Las filas
  // legacy sin fecha_fin siguen vigentes, pero al editarlas adquieren una.
  if (!fechaFin) return 'Indica la duración del destacado.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) return 'Fecha de fin inválida.'
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    return 'La fecha de fin no puede ser anterior a la de inicio.'
  }
  return null
}

export default async function handler(req) {
  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  try {
    if (req.method === 'GET') return await manejarGet()
    if (req.method === 'POST') return await manejarPost(req)
    if (req.method === 'PUT') return await manejarPut(req)
    if (req.method === 'PATCH') return await manejarPatch(req)
    if (req.method === 'DELETE') return await manejarDelete(req)

    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/super/destacados:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}

async function manejarGet() {
  const sql = obtenerSql()
  const filas = await sql`
    SELECT d.id, d.tipo, d.referencia_id, d.organizacion_id, d.orden, d.imagen_url,
           to_char(d.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
           to_char(d.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
           d.estado, d.creado_en,
           (d.estado = 'activo'
             AND d.fecha_inicio <= CURRENT_DATE
             AND (d.fecha_fin IS NULL OR d.fecha_fin >= CURRENT_DATE)) AS vigente,
           o.nombre AS organizacion_nombre
    FROM destacados d
    LEFT JOIN organizaciones o ON o.id = d.organizacion_id
    ORDER BY d.orden ASC, d.creado_en ASC
  `
  return json({ destacados: filas.map(aRespuesta) })
}

async function manejarPost(req) {
  const datos = await leerJson(req)
  const error = validar(datos)
  if (error) return json({ error }, 400)

  const { tipo, referenciaId, organizacionId, orden, imagenUrl, fechaInicio, fechaFin, estado } = datos
  const sql = obtenerSql()

  // Una fila por item (UNIQUE tipo+referencia): volver a destacar algo que ya
  // lo estuvo reutiliza su fila — no se guarda histórico de campañas.
  const filas = await sql`
    INSERT INTO destacados (tipo, referencia_id, organizacion_id, orden, imagen_url, fecha_inicio, fecha_fin, estado)
    VALUES (
      ${tipo}, ${referenciaId.trim()}, ${organizacionId || null}, ${Number.isInteger(orden) ? orden : 0},
      ${imagenUrl || null}, COALESCE(${fechaInicio || null}::date, CURRENT_DATE), ${fechaFin || null}, ${estado || 'activo'}
    )
    ON CONFLICT (tipo, referencia_id) DO UPDATE
      SET organizacion_id = EXCLUDED.organizacion_id,
          orden = EXCLUDED.orden,
          imagen_url = EXCLUDED.imagen_url,
          fecha_inicio = EXCLUDED.fecha_inicio,
          fecha_fin = EXCLUDED.fecha_fin,
          estado = EXCLUDED.estado,
          creado_en = now()
    RETURNING id, tipo, referencia_id, organizacion_id, orden, imagen_url,
              to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
              to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
              estado, creado_en,
              (estado = 'activo'
                AND fecha_inicio <= CURRENT_DATE
                AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)) AS vigente
  `

  if (filas.length === 0) return json({ error: 'No se pudo crear el destacado.' }, 400)
  return json({ destacado: aRespuesta(filas[0]) }, 201)
}

async function manejarPut(req) {
  const { id } = queryDe(req)
  if (!id || !UUID_REGEX.test(id)) return json({ error: 'ID inválido.' }, 400)

  const datos = await leerJson(req)
  const sql = obtenerSql()

  const existentes = await sql`SELECT tipo FROM destacados WHERE id = ${id}`
  if (existentes.length === 0) return json({ error: 'Destacado no encontrado.' }, 404)

  // tipo y referencia son inmutables (para apuntar a otro item: borrar y
  // crear); se valida con el tipo real de la fila para seguir exigiendo la
  // imagen a los comercios.
  const error = validar({ ...datos, tipo: existentes[0].tipo, referenciaId: 'n/a' })
  if (error) return json({ error }, 400)

  const { organizacionId, orden, imagenUrl, fechaInicio, fechaFin } = datos
  const filas = await sql`
    UPDATE destacados
    SET organizacion_id = ${organizacionId || null},
        orden = ${Number.isInteger(orden) ? orden : 0},
        imagen_url = ${imagenUrl || null},
        fecha_inicio = COALESCE(${fechaInicio || null}::date, fecha_inicio),
        fecha_fin = ${fechaFin || null}
    WHERE id = ${id}
    RETURNING id, tipo, referencia_id, organizacion_id, orden, imagen_url,
              to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
              to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
              estado, creado_en,
              (estado = 'activo'
                AND fecha_inicio <= CURRENT_DATE
                AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)) AS vigente
  `
  return json({ destacado: aRespuesta(filas[0]) })
}

async function manejarPatch(req) {
  const { id } = queryDe(req)
  if (!id || !UUID_REGEX.test(id)) return json({ error: 'ID inválido.' }, 400)

  const { estado } = await leerJson(req)
  if (!ESTADOS.includes(estado)) return json({ error: 'Estado no válido.' }, 400)

  const sql = obtenerSql()

  // Nada se activa sin duración: las solicitudes de las orgs nacen sin fechas
  // (las fija el superadmin) y las filas legacy pueden no tenerla. La UI abre
  // el formulario de edición en ese caso; esto es la red de seguridad.
  if (estado === 'activo') {
    const previas = await sql`SELECT fecha_fin FROM destacados WHERE id = ${id}`
    if (previas.length === 0) return json({ error: 'Destacado no encontrado.' }, 404)
    if (!previas[0].fecha_fin) {
      return json({ error: 'Asigna primero la duración editando el destacado.' }, 400)
    }
  }

  const filas = await sql`
    UPDATE destacados
    SET estado = ${estado}
    WHERE id = ${id}
    RETURNING id, tipo, referencia_id, organizacion_id, orden, imagen_url,
              to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
              to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
              estado, creado_en,
              (estado = 'activo'
                AND fecha_inicio <= CURRENT_DATE
                AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)) AS vigente
  `
  if (filas.length === 0) return json({ error: 'Destacado no encontrado.' }, 404)
  return json({ destacado: aRespuesta(filas[0]) })
}

async function manejarDelete(req) {
  const { id } = queryDe(req)
  if (!id || !UUID_REGEX.test(id)) return json({ error: 'ID inválido.' }, 400)

  const sql = obtenerSql()
  const filas = await sql`DELETE FROM destacados WHERE id = ${id} RETURNING id`
  if (filas.length === 0) return json({ error: 'Destacado no encontrado.' }, 404)
  return json({ eliminado: true })
}
