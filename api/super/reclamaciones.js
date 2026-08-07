// /api/super/reclamaciones
//   GET            — lista todas las solicitudes de reclamación (default: pendientes)
//   PATCH  ?id=…   — aprueba/rechaza una solicitud
// Solo superadmin. Si se aprueba, crea automáticamente la organización,
// vincula el comercio_id, genera un código de invitación y envía email.
import { obtenerSql } from '../_db.js'
import { requerirSuperAdminEdge } from '../_auth.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from '../_http.js'
import { generarCodigoInvitacion } from './_codigo.js'
import comercios from '../../src/data/comercios.json' assert { type: 'json' }
import servicios from '../../src/data/servicios-locales.json' assert { type: 'json' }

export const config = { runtime: 'edge' }

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM = 'noreply@ennavalcarnero.es'
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

async function enviarCorreo(email, nombre, codigo, comercioNombre) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurado, saltando envío de correo')
    return
  }

  const enlaceRegistro = `${APP_URL}/registro?codigo=${codigo}`
  const emailDest = process.env.NODE_ENV === 'production' ? email : 'danielmolino@gmail.com'

  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: emailDest,
        subject: `Reclamación aprobada: ${comercioNombre} - En Navalcarnero${process.env.NODE_ENV !== 'production' ? ' [TEST]' : ''}`,
        html: `
          <h2>¡Tu reclamación ha sido aprobada! 🎉</h2>
          <p>Hola <strong>${nombre}</strong>,</p>
          <p>Tu solicitud de reclamación del comercio <strong>${comercioNombre}</strong> ha sido aprobada.</p>
          <p>Ahora puedes registrarte como administrador de tu negocio en la app "En Navalcarnero" usando el siguiente código:</p>
          <p style="background: #f5f5f5; padding: 12px; border-left: 4px solid #b0472f; font-family: monospace; font-size: 16px; font-weight: bold;">
            ${codigo}
          </p>
          <p><a href="${enlaceRegistro}" style="background: #b0472f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Registrarse ahora</a></p>
          <p>Una vez registrado, podrás gestionar tu perfil comercial, agregar fotos, horarios y más.</p>
          <p>¿Preguntas? Contáctanos respondiendo a este correo.</p>
          <p>Saludos,<br>El equipo de En Navalcarnero</p>
        `,
      }),
    })

    if (!respuesta.ok) {
      const error = await respuesta.json()
      console.error('Error al enviar correo con Resend:', error)
    } else {
      console.log(`✓ Correo enviado a ${emailDest}${process.env.NODE_ENV !== 'production' ? ` (solicitud original: ${email})` : ''}`)
    }
  } catch (error) {
    console.error('Error enviando correo:', error)
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Cache de búsqueda: comercio_id → {nombre, foto, categoria}
const comerciosPorId = new Map()
const cargaComercios = () => {
  if (comerciosPorId.size === 0) {
    comercios.forEach((c) => {
      comerciosPorId.set(c.id, {
        nombre: c.nombre,
        foto: c.foto ?? null,
        categoria: c.categoria ?? c.tipo ?? null,
      })
    })
    servicios.forEach((c) => {
      if (!comerciosPorId.has(c.id)) {
        comerciosPorId.set(c.id, {
          nombre: c.nombre,
          foto: null,
          categoria: c.categoria ?? c.tipo ?? null,
        })
      }
    })
  }
}

async function listar(sql, estado) {
  cargaComercios()

  const filas = await sql`
    SELECT id, comercio_id, nombre, email, telefono, mensaje, estado,
           to_char(creado_en, 'YYYY-MM-DD HH24:MI') AS creado_en
    FROM solicitudes_reclamacion
    ${estado ? sql`WHERE estado = ${estado}` : sql``}
    ORDER BY creado_en DESC
  `

  return json({
    reclamaciones: filas.map((r) => {
      const detalles = comerciosPorId.get(r.comercio_id)
      return {
        id: r.id,
        comercioId: r.comercio_id,
        nombre: r.nombre,
        email: r.email,
        telefono: r.telefono,
        mensaje: r.mensaje,
        estado: r.estado,
        creadoEn: r.creado_en,
        detallesComercio: detalles || null,
      }
    }),
  })
}

async function aprobar(sql, solicitudId) {
  cargaComercios()

  // 1. Obtener la solicitud
  const [solicitud] = await sql`
    SELECT id, comercio_id, nombre, email
    FROM solicitudes_reclamacion
    WHERE id = ${solicitudId}
  `

  if (!solicitud) {
    return json({ error: 'Solicitud no encontrada.' }, 404)
  }

  if (solicitud.estado === 'aprobada' || solicitud.estado === 'rechazada') {
    return json({ error: `Solicitud ya ${solicitud.estado}.` }, 409)
  }

  try {
    // 2. Crear la organización (si no existe ya vinculada)
    const detalles = comerciosPorId.get(solicitud.comercio_id) || {}
    const orgNombre = detalles.nombre || solicitud.nombre
    const orgSlug = solicitud.comercio_id

    // Detectar si es cultural (categoría 'ocio_cultura')
    const esCultural = detalles.categoria === 'ocio_cultura'
    const categoriaDefecto = esCultural ? 'cultura' : null
    const lugarDefecto = null

    const [orgExistente] = await sql`
      SELECT id FROM organizaciones WHERE comercio_id = ${solicitud.comercio_id}
    `

    let orgId
    if (orgExistente) {
      orgId = orgExistente.id
    } else {
      const [nuevaOrg] = await sql`
        INSERT INTO organizaciones (
          nombre,
          slug,
          comercio_id,
          categoria_defecto,
          lugar_defecto,
          activa
        )
        VALUES (
          ${orgNombre},
          ${orgSlug},
          ${solicitud.comercio_id},
          ${categoriaDefecto},
          ${lugarDefecto},
          true
        )
        RETURNING id
      `
      orgId = nuevaOrg.id
    }

    // 3. Generar código de invitación (único, 1 uso, vinculado al comercio)
    const codigo = generarCodigoInvitacion()
    await sql`
      INSERT INTO codigos_invitacion (
        codigo,
        organizacion_id,
        comercio_id,
        rol_concedido,
        usos_maximos
      )
      VALUES (
        ${codigo},
        ${orgId},
        ${solicitud.comercio_id},
        'admin',
        1
      )
    `

    // 4. Marcar solicitud como aprobada
    await sql`
      UPDATE solicitudes_reclamacion
      SET estado = 'aprobada'
      WHERE id = ${solicitudId}
    `

    // 5. Enviar email con código de invitación
    await enviarCorreo(solicitud.email, solicitud.nombre, codigo, detalles.nombre || solicitud.nombre)

    return json({ ok: true, codigo }, 200)
  } catch (error) {
    console.error('Error al aprobar reclamación:', error)
    return json({ error: 'Error en el servidor.' }, 500)
  }
}

async function rechazar(sql, solicitudId) {
  const [solicitud] = await sql`
    SELECT estado FROM solicitudes_reclamacion WHERE id = ${solicitudId}
  `

  if (!solicitud) {
    return json({ error: 'Solicitud no encontrada.' }, 404)
  }

  if (solicitud.estado !== 'pendiente') {
    return json({ error: `No se puede rechazar. Estado actual: ${solicitud.estado}.` }, 409)
  }

  try {
    await sql`
      UPDATE solicitudes_reclamacion
      SET estado = 'rechazada'
      WHERE id = ${solicitudId}
    `
    return json({ ok: true }, 200)
  } catch (error) {
    console.error('Error al rechazar reclamación:', error)
    return json({ error: 'Error en el servidor.' }, 500)
  }
}

export default async function handler(req) {
  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  try {
    const sql = obtenerSql()

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const estado = url.searchParams.get('estado') || 'pendiente'
      return await listar(sql, estado)
    }

    if (req.method === 'PATCH') {
      if (csrfInvalido(req)) return rechazoCsrf()
      const url = new URL(req.url)
      const solicitudId = url.searchParams.get('id')

      if (!solicitudId || !UUID.test(solicitudId)) {
        return json({ error: 'ID de solicitud no válido.' }, 400)
      }

      const { estado } = await leerJson(req)
      if (estado === 'aprobada') {
        return await aprobar(sql, solicitudId)
      } else if (estado === 'rechazada') {
        return await rechazar(sql, solicitudId)
      } else {
        return json({ error: 'Estado no válido.' }, 400)
      }
    }

    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/super/reclamaciones:', error)
    return json({ error: 'Error en el servidor.' }, 500)
  }
}
