// /api/admin/comercio-perfil
//   GET  — obtiene el perfil enriquecido del comercio vinculado a la org
//   PUT  — actualiza/crea el perfil del comercio
// Solo visible si la org tiene comercio_id vinculado.
import { obtenerSql } from '../_db.js'
import { requerirSesionEdge } from '../_auth.js'
import { organizacionDeSesion } from '../_organizacion.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from '../_http.js'

export const config = { runtime: 'edge' }

const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

function validarHorarios(horarios) {
  if (!Array.isArray(horarios)) return false
  return horarios.every((h) => {
    if (typeof h !== 'object' || h === null) return false
    if (!DIAS_SEMANA.includes(h.dia)) return false
    if (typeof h.abierto !== 'boolean') return false
    if (h.abierto) {
      if (!/^\d{2}:\d{2}$/.test(h.apertura) || !/^\d{2}:\d{2}$/.test(h.cierre)) return false
    }
    return true
  })
}

async function obtener(sql, org) {
  if (!org.comercio_id) {
    return json({ error: 'Org sin comercio vinculado.' }, 404)
  }

  const [perfil] = await sql`
    SELECT comercio_id, descripcion, horarios, foto_principal, fotos,
           web, telefono, direccion, lat, lng,
           linkedin, facebook, instagram, twitter, tiktok
    FROM comercios_perfil
    WHERE comercio_id = ${org.comercio_id}
  `

  return json({
    perfil: perfil || null,
    comercioId: org.comercio_id,
  })
}

async function actualizar(sql, org, cuerpo) {
  if (!org.comercio_id) {
    return json({ error: 'Org sin comercio vinculado.' }, 404)
  }

  const { descripcion, horarios, fotoPrincipal, fotos, web, telefono, direccion, lat, lng, linkedin, facebook, instagram, twitter, tiktok } = cuerpo

  // Foto principal es obligatoria
  if (!fotoPrincipal || !String(fotoPrincipal).trim()) {
    return json({ error: 'La foto principal es obligatoria.' }, 400)
  }

  // Validar longitudes
  if (descripcion && String(descripcion).length > 1000) {
    return json({ error: 'Descripción no puede superar 1000 caracteres.' }, 400)
  }
  if (web && String(web).length > 255) {
    return json({ error: 'Web no puede superar 255 caracteres.' }, 400)
  }
  if (telefono && String(telefono).length > 20) {
    return json({ error: 'Teléfono no puede superar 20 caracteres.' }, 400)
  }
  if (direccion && String(direccion).length > 255) {
    return json({ error: 'Dirección no puede superar 255 caracteres.' }, 400)
  }

  // Validar redes sociales
  const redesSociales = { linkedin, facebook, instagram, twitter, tiktok }
  for (const [red, valor] of Object.entries(redesSociales)) {
    if (valor && String(valor).length > 255) {
      return json({ error: `${red} no puede superar 255 caracteres.` }, 400)
    }
  }

  // Validar horarios si se proporcionan
  if (horarios && !validarHorarios(horarios)) {
    return json({ error: 'Formato de horarios no válido.' }, 400)
  }

  // Validar coordenadas
  if ((lat ?? lng) && (typeof lat !== 'number' || typeof lng !== 'number')) {
    return json({ error: 'Coordenadas deben ser números.' }, 400)
  }

  // Filtrar fotos vacías (null o strings vacías)
  const fotosLimpias = fotos ? fotos.filter(f => f && String(f).trim()) : []

  try {
    await sql`
      INSERT INTO comercios_perfil (
        comercio_id,
        organizacion_id,
        descripcion,
        horarios,
        foto_principal,
        fotos,
        web,
        telefono,
        direccion,
        lat,
        lng,
        linkedin,
        facebook,
        instagram,
        twitter,
        tiktok
      )
      VALUES (
        ${org.comercio_id},
        ${org.id},
        ${descripcion ? String(descripcion).trim() : null},
        ${horarios ? JSON.stringify(horarios) : null},
        ${String(fotoPrincipal).trim()},
        ${fotosLimpias.length > 0 ? JSON.stringify(fotosLimpias) : null},
        ${web ? String(web).trim() : null},
        ${telefono ? String(telefono).trim() : null},
        ${direccion ? String(direccion).trim() : null},
        ${lat ?? null},
        ${lng ?? null},
        ${linkedin ? String(linkedin).trim() : null},
        ${facebook ? String(facebook).trim() : null},
        ${instagram ? String(instagram).trim() : null},
        ${twitter ? String(twitter).trim() : null},
        ${tiktok ? String(tiktok).trim() : null}
      )
      ON CONFLICT (comercio_id)
      DO UPDATE SET
        organizacion_id = EXCLUDED.organizacion_id,
        descripcion = EXCLUDED.descripcion,
        horarios = EXCLUDED.horarios,
        foto_principal = EXCLUDED.foto_principal,
        fotos = EXCLUDED.fotos,
        web = EXCLUDED.web,
        telefono = EXCLUDED.telefono,
        direccion = EXCLUDED.direccion,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        linkedin = EXCLUDED.linkedin,
        facebook = EXCLUDED.facebook,
        instagram = EXCLUDED.instagram,
        twitter = EXCLUDED.twitter,
        tiktok = EXCLUDED.tiktok,
        actualizado_en = now()
    `

    const [perfil] = await sql`
      SELECT comercio_id, descripcion, horarios, foto_principal, fotos,
             web, telefono, direccion, lat, lng,
             linkedin, facebook, instagram, twitter, tiktok
      FROM comercios_perfil
      WHERE comercio_id = ${org.comercio_id}
    `

    return json({ ok: true, perfil })
  } catch (error) {
    console.error('Error al actualizar perfil de comercio:', error)
    return json({ error: 'Error en el servidor.' }, 500)
  }
}

export default async function handler(req) {
  const sesion = await requerirSesionEdge(req)
  if (sesion instanceof Response) return sesion

  if (!sesion.organizacionSlug) {
    return json({ error: 'Sesión no válida.' }, 401)
  }

  try {
    const sql = obtenerSql()
    const org = await organizacionDeSesion(sql, sesion.organizacionSlug)

    if (req.method === 'GET') {
      return await obtener(sql, org)
    }

    if (req.method === 'PUT') {
      if (csrfInvalido(req)) return rechazoCsrf()
      const cuerpo = await leerJson(req)
      return await actualizar(sql, org, cuerpo)
    }

    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/admin/comercio-perfil:', error)
    return json({ error: 'Error en el servidor.' }, 500)
  }
}
