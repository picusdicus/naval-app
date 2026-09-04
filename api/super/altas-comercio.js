// /api/super/altas-comercio
//   GET            — lista solicitudes de alta de negocio (default: pendientes)
//   PATCH  ?id=…   — aprueba/rechaza una solicitud
// Solo superadmin. Aprobar NO escribe en esta tabla como fuente de verdad del
// directorio: publica la ficha con un commit real a servicios-locales.json
// (mismo mecanismo que api/super/comercios.js), y solo entonces marca la
// solicitud como aprobada — si el commit falla, la solicitud sigue pendiente
// para poder reintentar.
import { obtenerSql } from '../_db.js'
import { requerirSuperAdminEdge } from '../_auth.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from '../_http.js'
import { leerArchivoRepo, commitArchivosConDetalle } from '../_github.js'
import { CATEGORIAS } from '../../src/lib/categorias.js'
import { SUBTIPO_INFO } from '../../src/lib/subtipos.js'

export const config = { runtime: 'edge' }

const RUTA_SERVICIOS = 'src/data/servicios-locales.json'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function slug(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function idUnico(categoria, nombre, existentes) {
  const base = `local/${categoria}-${slug(nombre)}`
  if (!existentes.has(base)) return base
  let n = 2
  while (existentes.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

async function listar(sql, estado) {
  const filas = await sql`
    SELECT id, nombre, categoria, direccion, telefono, notas, estado,
           to_char(creado_en, 'YYYY-MM-DD HH24:MI') AS creado_en
    FROM solicitudes_alta_comercio
    ${estado ? sql`WHERE estado = ${estado}` : sql``}
    ORDER BY creado_en DESC
  `

  return json({
    altas: filas.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      categoria: r.categoria,
      direccion: r.direccion,
      telefono: r.telefono,
      notas: r.notas,
      estado: r.estado,
      creadoEn: r.creado_en,
    })),
  })
}

async function rechazar(sql, solicitudId) {
  const [solicitud] = await sql`
    SELECT estado FROM solicitudes_alta_comercio WHERE id = ${solicitudId}
  `

  if (!solicitud) {
    return json({ error: 'Solicitud no encontrada.' }, 404)
  }
  if (solicitud.estado !== 'pendiente') {
    return json({ error: `No se puede rechazar. Estado actual: ${solicitud.estado}.` }, 409)
  }

  try {
    await sql`
      UPDATE solicitudes_alta_comercio
      SET estado = 'rechazada'
      WHERE id = ${solicitudId}
    `
    return json({ ok: true }, 200)
  } catch (error) {
    console.error('Error al rechazar alta de comercio:', error)
    return json({ error: 'Error en el servidor.' }, 500)
  }
}

async function aprobar(sql, solicitudId, ficha) {
  const [solicitud] = await sql`
    SELECT id, estado FROM solicitudes_alta_comercio WHERE id = ${solicitudId}
  `

  if (!solicitud) {
    return json({ error: 'Solicitud no encontrada.' }, 404)
  }
  if (solicitud.estado !== 'pendiente') {
    return json({ error: `No se puede aprobar. Estado actual: ${solicitud.estado}.` }, 409)
  }

  const { nombre, categoria, subtipo, direccion, telefono, web, horario } = ficha

  if (typeof nombre !== 'string' || nombre.trim().length === 0 || nombre.length > 100) {
    return json({ error: 'Nombre inválido.' }, 400)
  }
  if (!Object.keys(CATEGORIAS).includes(categoria)) {
    return json({ error: `Categoría desconocida: ${String(categoria).slice(0, 30)}` }, 400)
  }
  if (!Object.keys(SUBTIPO_INFO).includes(subtipo)) {
    return json({ error: `Subtipo desconocido: ${String(subtipo).slice(0, 30)}` }, 400)
  }
  if (typeof direccion !== 'string' || direccion.trim().length === 0 || direccion.length > 200) {
    return json({ error: 'Dirección inválida.' }, 400)
  }

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    return json({ error: 'Falta configurar GITHUB_TOKEN / GITHUB_REPO en el servidor.' }, 503)
  }

  try {
    const textoServicios = await leerArchivoRepo(RUTA_SERVICIOS)
    const servicios = textoServicios ? JSON.parse(textoServicios) : []
    const idsExistentes = new Set(servicios.map((s) => s.id))

    const id = idUnico(categoria, nombre, idsExistentes)

    const nuevaFicha = {
      id,
      nombre: nombre.trim(),
      categoria,
      subtipo,
      cocina: [],
      lat: null,
      lng: null,
      direccion: direccion.trim(),
      telefono: telefono ? String(telefono).trim() : '',
      web: web ? String(web).trim() : '',
      horario: horario ? String(horario).trim() : '',
      rating: null,
      totalReviews: null,
      precioNivel: '',
      tipoDisplay: '',
      fuente: 'alta-vecinal',
      fuenteCategoria: null,
      fuenteSubcategoria: null,
    }

    servicios.push(nuevaFicha)

    const commit = await commitArchivosConDetalle(
      [{ path: RUTA_SERVICIOS, contenido: JSON.stringify(servicios, null, 2) + '\n' }],
      `Comercios: alta vecinal aprobada — ${nuevaFicha.nombre}`,
    )

    if (!commit.ok) {
      return json({ error: `No se pudo hacer el commit a GitHub. ${commit.error}` }, 502)
    }

    await sql`
      UPDATE solicitudes_alta_comercio
      SET estado = 'aprobada'
      WHERE id = ${solicitudId}
    `

    return json({ ok: true, comercioId: id }, 200)
  } catch (error) {
    console.error('Error al aprobar alta de comercio:', error)
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

      const cuerpo = await leerJson(req)
      if (cuerpo.estado === 'aprobada') {
        return await aprobar(sql, solicitudId, cuerpo)
      } else if (cuerpo.estado === 'rechazada') {
        return await rechazar(sql, solicitudId)
      } else {
        return json({ error: 'Estado no válido.' }, 400)
      }
    }

    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/super/altas-comercio:', error)
    return json({ error: 'Error en el servidor.' }, 500)
  }
}
