// POST /api/super/comercios-alta — alta MANUAL de un comercio desde el panel
// superadmin (tab Comercios → "Añadir comercio").
//
// Recibe la ficha completa (los mismos campos que una entrada de Google Places
// en comercios.json), la valida con src/lib/comercioForm.js (la misma
// definición que ejecuta el formulario) y la publica con UN commit a
// servicios-locales.json — el mismo mecanismo que la bandeja de altas
// vecinales (api/super/altas-comercio.js) y las correcciones
// (api/super/comercios.js). Va a servicios-locales.json y NO a comercios.json
// a propósito: comercios.json lo regenera `npm run fetch:comercios`, que solo
// conserva los ids gpl_ (fase 1b) y pisaría cualquier entrada añadida a mano;
// servicios-locales.json sobrevive a la regeneración (y si algún día Places
// confirma el negocio, la fase 4 del script lo absorbe con sus coordenadas).
//
// Duplicados: se compara el nombre normalizado con comercios.json (copia del
// build) y con servicios-locales.json (leído del repo, que es lo que se va a
// escribir). Si coincide, 409 con el nombre existente salvo que el cuerpo
// traiga `forzar: true` (el superadmin ha visto el aviso y sabe que son dos
// locales distintos con el mismo rótulo — pasa con las cadenas).
import { requerirSuperAdminEdge } from '../_auth.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from '../_http.js'
import { leerArchivoRepo, commitArchivosConDetalle } from '../_github.js'
import { CATEGORIAS } from '../../src/lib/categorias.js'
import { SUBTIPO_INFO } from '../../src/lib/subtipos.js'
import {
  validarComercio,
  construirFichaComercio,
  idLocalUnico,
  claveNombreComercio,
} from '../../src/lib/comercioForm.js'
import comercios from '../../src/data/comercios.json'

export const config = { runtime: 'edge' }

const RUTA_SERVICIOS = 'src/data/servicios-locales.json'

function buscarDuplicado(nombre, servicios) {
  const clave = claveNombreComercio(nombre)
  if (!clave) return null
  for (const c of [...comercios, ...servicios]) {
    if (claveNombreComercio(c.nombre) === clave) return { id: c.id, nombre: c.nombre }
  }
  return null
}

export default async function handler(req) {
  if (csrfInvalido(req)) return rechazoCsrf()

  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  const cuerpo = await leerJson(req)
  if (!cuerpo || typeof cuerpo !== 'object') return json({ error: 'Cuerpo inválido.' }, 400)

  const errores = validarComercio(cuerpo, {
    categorias: new Set(Object.keys(CATEGORIAS)),
    subtipos: new Set(Object.keys(SUBTIPO_INFO)),
  })
  if (Object.keys(errores).length > 0) {
    return json({ error: 'Revisa los campos marcados.', errores }, 400)
  }

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    return json({ error: 'Falta configurar GITHUB_TOKEN / GITHUB_REPO en el servidor.' }, 503)
  }

  try {
    const textoServicios = await leerArchivoRepo(RUTA_SERVICIOS)
    const servicios = textoServicios ? JSON.parse(textoServicios) : []

    const duplicado = buscarDuplicado(cuerpo.nombre, servicios)
    if (duplicado && cuerpo.forzar !== true) {
      return json(
        {
          error: `Ya existe un comercio llamado «${duplicado.nombre}» (${duplicado.id}). Si es otro local, confirma el alta.`,
          duplicado,
        },
        409,
      )
    }

    const idsExistentes = new Set([...comercios.map((c) => c.id), ...servicios.map((s) => s.id)])
    const id = idLocalUnico(cuerpo.categoria, cuerpo.nombre, idsExistentes)
    const ficha = construirFichaComercio(cuerpo, id)

    servicios.push(ficha)

    const commit = await commitArchivosConDetalle(
      [{ path: RUTA_SERVICIOS, contenido: JSON.stringify(servicios, null, 2) + '\n' }],
      `Comercios: alta manual desde el panel — ${ficha.nombre}`,
    )
    if (!commit.ok) {
      return json({ error: `No se pudo hacer el commit a GitHub. ${commit.error}` }, 502)
    }

    return json({ ok: true, comercio: ficha }, 201)
  } catch (err) {
    console.error('Error en /api/super/comercios-alta:', err)
    return json({ error: 'No se pudo dar de alta el comercio.' }, 500)
  }
}
