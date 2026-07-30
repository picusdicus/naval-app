// POST /api/super/comercios — correcciones de categorización del directorio.
//
// El superadmin envía un lote de cambios { id: { categoria, subtipo } | { excluir } }
// y, opcionalmente, categorías/subcategorías nuevas creadas desde el panel.
// El endpoint hace UN commit a GitHub (rama main, misma infraestructura que el
// cron de eventos) con hasta cuatro archivos: comercios-overrides.json (la
// corrección curada, que el fetch reaplica en cada regeneración),
// comercios.json (el mismo cambio aplicado al dato vigente), y
// categorias-extra.js / subtipos-extra.js (la taxonomía creada desde el panel,
// fusionada en src/lib al compilar). Vercel redespliega con el commit y todo
// queda visible en ~2 minutos.
import { requerirSuperAdminEdge } from '../_auth.js'
import { json, leerJson, csrfInvalido, rechazoCsrf } from '../_http.js'
import { leerArchivoRepo, commitArchivosConDetalle } from '../_github.js'
import { CATEGORIAS } from '../../src/lib/categorias.js'
import { SUBTIPO_INFO } from '../../src/lib/subtipos.js'

export const config = { runtime: 'edge' }

const RUTA_OVERRIDES = 'src/data/comercios-overrides.json'
const RUTA_COMERCIOS = 'src/data/comercios.json'
const RUTA_SERVICIOS = 'src/data/servicios-locales.json'
const RUTA_CATEGORIAS_EXTRA = 'src/data/categorias-extra.js'
const RUTA_SUBTIPOS_EXTRA = 'src/data/subtipos-extra.js'

// Dos familias de id editables:
//  · gpl_… : entradas de Google Places. La corrección va al override (el fetch
//    la reaplica en cada regeneración) y al comercios.json vigente.
//  · local/… : servicios curados a mano. No hay override ni regeneración: se
//    edita el propio servicios-locales.json. No se pueden excluir desde el
//    panel (borrar un curado sería irreversible; se gestiona en el fichero).
const ID_REGEX = /^gpl_[A-Za-z0-9_-]{5,120}$/
const LOCAL_ID_REGEX = /^local\/[a-z0-9_-]{2,120}$/
const esLocal = (id) => LOCAL_ID_REGEX.test(id)
const SLUG_REGEX = /^[a-z][a-z0-9_]{1,29}$/
const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/
const ICONO_REGEX = /^[a-z][a-z0-9_]{1,39}$/
const MAX_CAMBIOS = 50
const MAX_NUEVAS = 10

// Datos de contacto/ubicación que el superadmin puede corregir además de la
// categorización. Se guardan en el override (se reaplican en cada regeneración
// del directorio, congelando el dato frente a lo que devuelva Google) y en el
// comercios.json vigente. Solo llegan los campos que el panel modificó.
const CAMPOS_DATOS = ['direccion', 'telefono', 'web', 'lat', 'lng']
const TELEFONO_REGEX = /^[0-9+()\s.-]{0,30}$/
const DIRECCION_MAX = 200
const WEB_MAX = 300

// Coordenada de comercios.json → número, o null si viene vacía/nula.
function aCoordenada(valor) {
  return valor === null || valor === undefined || valor === '' ? null : Number(valor)
}

// Valida los campos de datos presentes en un cambio. Devuelve error o null.
function validarDatos(cambio) {
  if ('direccion' in cambio) {
    if (typeof cambio.direccion !== 'string' || cambio.direccion.length > DIRECCION_MAX) {
      return 'Dirección inválida (máx. 200 caracteres).'
    }
  }
  if ('telefono' in cambio) {
    if (typeof cambio.telefono !== 'string' || !TELEFONO_REGEX.test(cambio.telefono)) {
      return 'Teléfono inválido.'
    }
  }
  if ('web' in cambio) {
    const w = typeof cambio.web === 'string' ? cambio.web.trim() : null
    if (w === null || cambio.web.length > WEB_MAX || (w && !/^https?:\/\/.+/i.test(w))) {
      return 'Web inválida (debe empezar por http:// o https://).'
    }
  }
  for (const clave of ['lat', 'lng']) {
    if (clave in cambio && cambio[clave] !== null && cambio[clave] !== '') {
      const n = Number(cambio[clave])
      if (!Number.isFinite(n)) return `Coordenada ${clave} inválida.`
      if (clave === 'lat' && (n < -90 || n > 90)) return 'Latitud fuera de rango (-90 a 90).'
      if (clave === 'lng' && (n < -180 || n > 180)) return 'Longitud fuera de rango (-180 a 180).'
    }
  }
  return null
}

// Los módulos extra los escribe solo este endpoint, siempre con este formato:
// cabecera de comentarios + `export default <json>`. parsearExtra confía en él.
function parsearExtra(texto) {
  if (!texto) return {}
  const m = texto.match(/export default ([\s\S]+)$/)
  return m ? JSON.parse(m[1]) : {}
}

function serializarExtra(objeto, cabecera) {
  return `${cabecera}export default ${JSON.stringify(objeto, null, 2)}\n`
}

const CABECERA_CATEGORIAS = `// Categorías del directorio creadas desde el panel superadmin (tab Comercios).
// NO editar a mano: api/super/comercios.js reescribe el archivo entero en cada
// commit. Forma: { id: { nombre, color, icono } } — se fusionan con las
// categorías base en src/lib/categorias.js y src/components/directorio/iconosCategoria.jsx.
`
const CABECERA_SUBTIPOS = `// Subcategorías del directorio creadas desde el panel superadmin (tab
// Comercios). NO editar a mano: api/super/comercios.js reescribe el archivo
// entero en cada commit. Forma: { clave: { nombre, icono } } — se fusionan con
// las base en src/lib/subtipos.js.
`

function validarNuevas(nuevas, tipo) {
  if (nuevas === undefined) return null
  if (!nuevas || typeof nuevas !== 'object' || Array.isArray(nuevas)) {
    return `Formato inválido de ${tipo} nuevas.`
  }
  const entradas = Object.entries(nuevas)
  if (entradas.length > MAX_NUEVAS) return `Máximo ${MAX_NUEVAS} ${tipo} nuevas por guardado.`
  for (const [clave, def] of entradas) {
    if (!SLUG_REGEX.test(clave)) return `Identificador inválido: ${String(clave).slice(0, 40)}`
    if (!def || typeof def !== 'object') return `Definición inválida de ${clave}.`
    if (typeof def.nombre !== 'string' || def.nombre.trim().length < 2 || def.nombre.length > 40) {
      return `Nombre inválido para ${clave} (2–40 caracteres).`
    }
    if (tipo === 'categorías' && !COLOR_REGEX.test(def.color || '')) {
      return `Color inválido para ${clave} (formato #RRGGBB).`
    }
    if (def.icono !== undefined && !ICONO_REGEX.test(def.icono)) {
      return `Icono inválido para ${clave} (nombre de Material Symbol).`
    }
  }
  return null
}

function validarCambios(cambios, categoriasValidas, subtiposValidos) {
  if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) {
    return 'Falta el objeto de cambios.'
  }
  const entradas = Object.entries(cambios)
  if (entradas.length > MAX_CAMBIOS) return `Máximo ${MAX_CAMBIOS} cambios por guardado.`

  for (const [id, cambio] of entradas) {
    if (!ID_REGEX.test(id) && !LOCAL_ID_REGEX.test(id)) return `ID de comercio inválido: ${id.slice(0, 40)}`
    if (!cambio || typeof cambio !== 'object') return 'Cambio con formato inválido.'
    // Excluir un gpl_ es un override reversible; excluir un curado (local/…)
    // lo elimina de servicios-locales.json (permanente, recuperable solo por git).
    if (cambio.excluir === true) continue
    if (!categoriasValidas.has(cambio.categoria)) {
      return `Categoría desconocida: ${String(cambio.categoria).slice(0, 30)}`
    }
    if (!subtiposValidos.has(cambio.subtipo)) {
      return `Subtipo desconocido: ${String(cambio.subtipo).slice(0, 30)}`
    }
    const errorDatos = validarDatos(cambio)
    if (errorDatos) return `${errorDatos} (${id.slice(0, 20)}…)`
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

  const { cambios = {}, nuevasCategorias = {}, nuevosSubtipos = {} } = await leerJson(req)

  let error = validarNuevas(nuevasCategorias, 'categorías') || validarNuevas(nuevosSubtipos, 'subcategorías')
  if (error) return json({ error }, 400)

  const hayCambios = cambios && Object.keys(cambios).length > 0
  const hayNuevas = Object.keys(nuevasCategorias).length > 0 || Object.keys(nuevosSubtipos).length > 0
  if (!hayCambios && !hayNuevas) return json({ error: 'No hay nada que guardar.' }, 400)

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    return json({ error: 'Falta configurar GITHUB_TOKEN / GITHUB_REPO en el servidor.' }, 503)
  }

  try {
    // Estado actual en el repo (rama main).
    const [textoOverrides, textoComercios, textoServicios, textoCatsExtra, textoSubsExtra] =
      await Promise.all([
        leerArchivoRepo(RUTA_OVERRIDES),
        leerArchivoRepo(RUTA_COMERCIOS),
        leerArchivoRepo(RUTA_SERVICIOS),
        leerArchivoRepo(RUTA_CATEGORIAS_EXTRA),
        leerArchivoRepo(RUTA_SUBTIPOS_EXTRA),
      ])
    const overrides = textoOverrides ? JSON.parse(textoOverrides) : {}
    const comercios = textoComercios ? JSON.parse(textoComercios) : []
    const servicios = textoServicios ? JSON.parse(textoServicios) : []
    const categoriasExtra = parsearExtra(textoCatsExtra)
    const subtiposExtra = parsearExtra(textoSubsExtra)

    // Taxonomía nueva: se acumula sobre la ya creada (sin pisar la base).
    for (const [id, def] of Object.entries(nuevasCategorias)) {
      categoriasExtra[id] = {
        nombre: def.nombre.trim(),
        color: def.color,
        icono: def.icono || 'storefront',
      }
    }
    for (const [clave, def] of Object.entries(nuevosSubtipos)) {
      subtiposExtra[clave] = { nombre: def.nombre.trim(), icono: def.icono || 'storefront' }
    }

    // Los cambios se validan contra la taxonomía completa: la del build
    // (base + extra desplegada), la del repo (por si hay creaciones aún sin
    // desplegar) y la de esta misma petición.
    const categoriasValidas = new Set([
      ...Object.keys(CATEGORIAS),
      ...Object.keys(categoriasExtra),
    ])
    const subtiposValidos = new Set([...Object.keys(SUBTIPO_INFO), ...Object.keys(subtiposExtra)])
    error = validarCambios(cambios, categoriasValidas, subtiposValidos)
    if (error) return json({ error }, 400)

    // 1) Los cambios de Google Places (gpl_…) se acumulan en los overrides
    //    (fuente de verdad para futuras regeneraciones). Los curados (local/…)
    //    no tienen override: se editan directamente en servicios-locales.json (paso 3).
    let aplicadosJson = 0
    for (const [id, cambio] of Object.entries(cambios)) {
      if (esLocal(id)) continue
      if (cambio.excluir === true) {
        overrides[id] = { excluir: true }
      } else {
        const base = { ...(overrides[id] || {}), categoria: cambio.categoria, subtipo: cambio.subtipo }
        for (const clave of CAMPOS_DATOS) {
          if (clave in cambio) {
            base[clave] = clave === 'lat' || clave === 'lng' ? aCoordenada(cambio[clave]) : cambio[clave]
          }
        }
        delete base.excluir // una recategorización anula una exclusión previa
        overrides[id] = base
      }
    }

    // 2) Aplicar al JSON vigente para no esperar a la próxima regeneración.
    const corregidos = comercios.filter((c) => cambios[c.id]?.excluir !== true)
    for (const c of corregidos) {
      const cambio = cambios[c.id]
      if (!cambio || cambio.excluir === true) continue
      c.categoria = cambio.categoria
      c.subtipo = cambio.subtipo
      for (const clave of CAMPOS_DATOS) {
        if (clave in cambio) {
          c[clave] = clave === 'lat' || clave === 'lng' ? aCoordenada(cambio[clave]) : cambio[clave]
        }
      }
      aplicadosJson++
    }
    corregidos.sort((a, b) =>
      a.categoria !== b.categoria
        ? a.categoria.localeCompare(b.categoria, 'es')
        : a.nombre.localeCompare(b.nombre, 'es'),
    )

    // 3) Servicios curados (local/…): se edita el propio servicios-locales.json,
    //    conservando el orden y el resto de campos. Excluir un curado lo ELIMINA
    //    del fichero (no hay override que lo oculte); es permanente salvo git.
    let aplicadosServicios = 0
    let excluidosServicios = 0
    const serviciosFiltrados = servicios.filter((c) => {
      if (cambios[c.id]?.excluir === true) {
        excluidosServicios++
        return false
      }
      return true
    })
    for (const c of serviciosFiltrados) {
      const cambio = cambios[c.id]
      if (!cambio || cambio.excluir === true) continue
      c.categoria = cambio.categoria
      c.subtipo = cambio.subtipo
      for (const clave of CAMPOS_DATOS) {
        if (clave in cambio) {
          c[clave] = clave === 'lat' || clave === 'lng' ? aCoordenada(cambio[clave]) : cambio[clave]
        }
      }
      aplicadosServicios++
    }
    const serviciosModificado = aplicadosServicios > 0 || excluidosServicios > 0

    const cambiosGpl = Object.keys(cambios).some((id) => !esLocal(id))

    const archivos = []
    if (cambiosGpl) {
      archivos.push(
        { path: RUTA_OVERRIDES, contenido: JSON.stringify(overrides, null, 2) + '\n' },
        { path: RUTA_COMERCIOS, contenido: JSON.stringify(corregidos, null, 2) + '\n' },
      )
    }
    if (serviciosModificado) {
      archivos.push({ path: RUTA_SERVICIOS, contenido: JSON.stringify(serviciosFiltrados, null, 2) + '\n' })
    }
    if (Object.keys(nuevasCategorias).length > 0) {
      archivos.push({
        path: RUTA_CATEGORIAS_EXTRA,
        contenido: serializarExtra(categoriasExtra, CABECERA_CATEGORIAS),
      })
    }
    if (Object.keys(nuevosSubtipos).length > 0) {
      archivos.push({
        path: RUTA_SUBTIPOS_EXTRA,
        contenido: serializarExtra(subtiposExtra, CABECERA_SUBTIPOS),
      })
    }

    if (archivos.length === 0) {
      return json({ error: 'No se aplicó ningún cambio (revisa los identificadores).' }, 400)
    }

    const partes = []
    if (hayCambios) partes.push(`${Object.keys(cambios).length} correcciones`)
    if (hayNuevas) {
      partes.push(
        `${Object.keys(nuevasCategorias).length + Object.keys(nuevosSubtipos).length} taxonomias nuevas`,
      )
    }
    const commit = await commitArchivosConDetalle(
      archivos,
      `Comercios: ${partes.join(' y ')} desde el panel`,
    )

    if (!commit.ok) {
      return json({ error: `No se pudo hacer el commit a GitHub. ${commit.error}` }, 502)
    }

    const excluidos = comercios.length - corregidos.length
    return json({
      ok: true,
      guardados: Object.keys(cambios).length,
      aplicadosAlJson: aplicadosJson,
      serviciosActualizados: aplicadosServicios,
      serviciosExcluidos: excluidosServicios,
      excluidos,
      categoriasCreadas: Object.keys(nuevasCategorias).length,
      subtiposCreados: Object.keys(nuevosSubtipos).length,
    })
  } catch (err) {
    console.error('Error en /api/super/comercios:', err)
    return json({ error: 'No se pudieron guardar las correcciones.' }, 500)
  }
}
