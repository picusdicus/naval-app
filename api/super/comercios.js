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
const RUTA_CATEGORIAS_EXTRA = 'src/data/categorias-extra.js'
const RUTA_SUBTIPOS_EXTRA = 'src/data/subtipos-extra.js'

// Solo entradas de Google Places: los servicios curados (`local/…`) se editan
// a mano en servicios-locales.json y el fetch no les aplica overrides.
const ID_REGEX = /^gpl_[A-Za-z0-9_-]{5,120}$/
const SLUG_REGEX = /^[a-z][a-z0-9_]{1,29}$/
const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/
const ICONO_REGEX = /^[a-z][a-z0-9_]{1,39}$/
const MAX_CAMBIOS = 50
const MAX_NUEVAS = 10

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
    if (!ID_REGEX.test(id)) return `ID de comercio inválido: ${id.slice(0, 40)}`
    if (!cambio || typeof cambio !== 'object') return 'Cambio con formato inválido.'
    if (cambio.excluir === true) continue
    if (!categoriasValidas.has(cambio.categoria)) {
      return `Categoría desconocida: ${String(cambio.categoria).slice(0, 30)}`
    }
    if (!subtiposValidos.has(cambio.subtipo)) {
      return `Subtipo desconocido: ${String(cambio.subtipo).slice(0, 30)}`
    }
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
    const [textoOverrides, textoComercios, textoCatsExtra, textoSubsExtra] = await Promise.all([
      leerArchivoRepo(RUTA_OVERRIDES),
      leerArchivoRepo(RUTA_COMERCIOS),
      leerArchivoRepo(RUTA_CATEGORIAS_EXTRA),
      leerArchivoRepo(RUTA_SUBTIPOS_EXTRA),
    ])
    const overrides = textoOverrides ? JSON.parse(textoOverrides) : {}
    const comercios = textoComercios ? JSON.parse(textoComercios) : []
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

    // 1) Acumular en los overrides (fuente de verdad para futuras regeneraciones).
    let aplicadosJson = 0
    for (const [id, cambio] of Object.entries(cambios)) {
      if (cambio.excluir === true) {
        overrides[id] = { excluir: true }
      } else {
        overrides[id] = { ...(overrides[id] || {}), categoria: cambio.categoria, subtipo: cambio.subtipo }
        delete overrides[id].excluir // una recategorización anula una exclusión previa
      }
    }

    // 2) Aplicar al JSON vigente para no esperar a la próxima regeneración.
    const corregidos = comercios.filter((c) => cambios[c.id]?.excluir !== true)
    for (const c of corregidos) {
      const cambio = cambios[c.id]
      if (!cambio || cambio.excluir === true) continue
      c.categoria = cambio.categoria
      c.subtipo = cambio.subtipo
      aplicadosJson++
    }
    corregidos.sort((a, b) =>
      a.categoria !== b.categoria
        ? a.categoria.localeCompare(b.categoria, 'es')
        : a.nombre.localeCompare(b.nombre, 'es'),
    )

    const archivos = []
    if (hayCambios) {
      archivos.push(
        { path: RUTA_OVERRIDES, contenido: JSON.stringify(overrides, null, 2) + '\n' },
        { path: RUTA_COMERCIOS, contenido: JSON.stringify(corregidos, null, 2) + '\n' },
      )
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
      excluidos,
      categoriasCreadas: Object.keys(nuevasCategorias).length,
      subtiposCreados: Object.keys(nuevosSubtipos).length,
    })
  } catch (err) {
    console.error('Error en /api/super/comercios:', err)
    return json({ error: 'No se pudieron guardar las correcciones.' }, 500)
  }
}
