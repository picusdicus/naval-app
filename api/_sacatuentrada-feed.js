// Lectura de la taquilla online del Teatro Municipal Centro
// (https://teatrocentro.sacatuentrada.es/, plataforma genérica de
// infoticketing / tenemosplan.com). La portada lista las obras a la venta —
// no un catálogo: una función aparece cuando abre su venta y desaparece al
// pasar — con fecha, categoría, lugar, título, compañía, precio, cartel y
// enlaces de compra y de detalle. Es HTML servido en servidor y estable, así
// que basta un fetch + parseo; no hay paginación (verificado 2026-09-22:
// `?page=2` devuelve la misma portada y `?pagina=2` cero obras).
//
// MÓDULO PURO — sin Neon ni Blob — para que los scripts de diagnóstico
// (scripts/diagnostico-sacatuentrada.mjs) puedan importarlo sin crear filas
// reales, mismo reparto que el feed de deportes. La escritura vive en
// api/_sacatuentrada-revision.js y solo la llama api/sync-events.js.
//
// Respeto a la fuente: es un sitio de terceros sin API. Una petición a la
// portada por run (diaria, en el cron) y dos más (detalle + entradas), en
// secuencia, SOLO para obras que aún no conocemos. Sus condiciones autorizan
// expresamente enlazar a contenidos concretos (cláusula 7); el cartel se copia
// a Blob porque el CDN ha respondido 502 en varias tandas (ver revisión).

import { claveTitulo, titulosEquivalentes, titulosAproximados } from '../src/lib/dedupEventos.js'

export const SACATUENTRADA_URL = 'https://teatrocentro.sacatuentrada.es/es'
export const PREFIJO_ID = 'ste-'
export const LUGAR_TEATRO_CENTRO = 'Teatro Municipal Centro'
export const TEXTO_ENTRADAS = 'Comprar entradas'
const USER_AGENT = 'NavalcarneroApp/0.1 (proyecto vecinal; +https://ennavalcarnero.es)'
const TIMEOUT_MS = 15000

async function descargarTexto(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function decodificarEntidades(txt) {
  return String(txt || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#45;/g, '-')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

/**
 * HTML → texto plano con párrafos. La plataforma parte las frases con <br />
 * a mitad de línea (pegado del editor), así que un <br> es un espacio; el
 * cierre de <p>/<div> sí es un salto de párrafo.
 */
export function textoPlano(html) {
  return decodificarEntidades(
    String(html || '')
      .replace(/\s+/g, ' ') // los saltos crudos del HTML son espacio, no párrafo
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Título legible a partir del rótulo de la taquilla, que va en mayúsculas y
 * con el certamen como coletilla ("JULIETA Y ROMEO. CETAN 2026"): se quita
 * una última frase que sea siglas/nombre + año (la edición del certamen, que
 * no es parte del título de la obra y ya viaja en la descripción) y se pasa a
 * minúsculas tipográficas con inicial mayúscula por frase. No se intenta
 * restaurar nombres propios: el emparejamiento compara claves normalizadas y
 * el superadmin puede retocar el título desde Pendientes.
 */
export function tituloDeObra(rotulo) {
  const base = decodificarEntidades(rotulo).replace(/\s+/g, ' ').trim()
  const sinCertamen = base.replace(/\.\s*[\p{Lu}\d][\p{Lu}\d\s.'-]*\s\d{4}\.?\s*$/u, '').trim()
  const s = sinCertamen || base
  const letras = (s.match(/\p{L}/gu) || []).length
  const mays = (s.match(/\p{Lu}/gu) || []).length
  if (letras === 0 || mays / letras <= 0.7) return s
  return s
    .toLowerCase()
    .replace(/(^|[.!?¿¡:]\s*)(\p{Ll})/gu, (_, p, c) => p + c.toUpperCase())
}

/** Nombre del certamen si el rótulo lo lleva como coletilla ("CETAN 2026"), o ''. */
export function certamenDeRotulo(rotulo) {
  const m = decodificarEntidades(rotulo).match(/\.\s*([\p{Lu}\d][\p{Lu}\d\s.'-]*\s\d{4})\.?\s*$/u)
  return m ? m[1].replace(/\s+/g, ' ').trim() : ''
}

/**
 * "5&euro;" / "5.00€" / "Desde 5€" → "5 €". Un precio no reconocible se
 * devuelve limpio tal cual (el campo `precio` de la app es texto libre).
 */
export function precioLegible(txt) {
  const s = decodificarEntidades(txt).replace(/\s+/g, ' ').trim()
  const m = s.match(/(\d+(?:[.,]\d{1,2})?)\s*€/)
  if (!m) return s
  const n = m[1].replace(',', '.')
  const entero = Number(n)
  return `${Number.isInteger(entero) ? entero : n.replace('.', ',')} €`
}

/**
 * URL del cartel ORIGINAL a partir del `data-src` de la portada. La portada
 * pide una miniatura (`tiendas/0_<fichero>`) que el CDN de tenemosplan no
 * siempre sabe generar (502 en todas las pruebas del 2026-09-22), mientras
 * que el original sin el prefijo `0_` — el mismo que declara el JSON-LD de la
 * ficha — responde. Se devuelven ambas, original primero, para intentarlas en
 * orden.
 */
export function urlsDeCartel(dataSrc) {
  const u = decodificarEntidades(dataSrc).trim()
  if (!u || /no_image/.test(u)) return []
  const original = u.replace(/\/tiendas\/0_/, '/tiendas/')
  return original === u ? [u] : [original, u]
}

const DENTRO = (bloque, re) => {
  const m = bloque.match(re)
  return m ? decodificarEntidades(m[1]).replace(/\s+/g, ' ').trim() : ''
}

/**
 * Parsea la portada. Cada obra va precedida del comentario
 * `<!-- <idProducto> - <n> - <slug> -->` y termina en su bloque de enlaces.
 * Devuelve [{ idFuente, slug, fecha, categoria, lugar, rotulo, titulo,
 * certamen, compania, precio, urlsCartel, urlCompra, urlDetalle, textoVenta }]
 * en el orden de la portada. Una obra sin fecha, título o enlace de detalle
 * se omite (no hay con qué identificarla).
 */
export function parsearPortada(html) {
  const obras = []
  const re = /<!--\s*(\d+)\s*-\s*\d+\s*-\s*(\S+)\s*-->([\s\S]*?)(?=<!--\s*\d+\s*-\s*\d+\s*-\s*\S+\s*-->|<footer)/g
  for (const m of html.matchAll(re)) {
    const [, idFuente, slug, bloque] = m
    const fecha = DENTRO(bloque, /data-fecha="(\d{4}-\d{2}-\d{2})"/)
    const rotulo = DENTRO(bloque, /<h2 class="titulo[^"]*">([\s\S]*?)<\/h2>/)
    const urlDetalle = DENTRO(bloque, /href="\s*(https?:\/\/[^"\s]+\/productos\/descripcion\/[^"\s]+)\s*"/)
    if (!fecha || !rotulo || !urlDetalle) continue
    const venta = bloque.match(/<div class="descripcion">([\s\S]*?)<div class="enlaces/)
    obras.push({
      idFuente,
      slug,
      fecha,
      categoria: DENTRO(bloque, /<div class="categoria row">\s*<p[^>]*>([\s\S]*?)<\/p>/).toLowerCase(),
      lugar: DENTRO(bloque, /Lugar:(?:&nbsp;|\s)*<span[^>]*>([\s\S]*?)<\/span>/),
      rotulo,
      titulo: tituloDeObra(rotulo),
      certamen: certamenDeRotulo(rotulo),
      compania: DENTRO(bloque, /<h3 class="subtitulo[^"]*">([\s\S]*?)<\/h3>/).replace(/[.,;\s]+$/, ''),
      precio: precioLegible(DENTRO(bloque, /<div class="precio[^"]*">[\s\S]*?<span class="font-bold">([\s\S]*?)<\/span>/)),
      urlsCartel: urlsDeCartel(DENTRO(bloque, /data-src="([^"]+)"/)),
      urlCompra: DENTRO(bloque, /href="\s*(https?:\/\/[^"\s]+\/entradas\/[^"\s]+)\s*"/),
      urlDetalle,
      textoVenta: venta ? textoPlano(venta[1]) : '',
    })
  }
  return obras
}

/** Ficha de una obra: sinopsis (con la línea "Género. Público. Duración."). */
export function parsearDetalle(html) {
  const m = html.match(/<div class="contenido-descripcion[^"]*">[\s\S]*?<div class="texto">([\s\S]*?)<div class="texto-solo-web">/)
  return { sinopsis: m ? textoPlano(m[1]) : '' }
}

/** Página de entradas: horas de las sesiones del día (la primera es la que se usa). */
export function parsearEntradas(html) {
  const horas = [...html.matchAll(/<div class="calendario_reserva[^"]*">\s*<span>\s*(\d{1,2}:\d{2})\s*<\/span>/g)].map((m) =>
    m[1].padStart(5, '0'),
  )
  return { hora: horas[0] || null, sesiones: horas.length }
}

/** Id estable de una obra en `eventos_usuario.origen_externo_id`. */
export function idDeObra(obra) {
  return `${PREFIJO_ID}${obra.idFuente}-${obra.fecha}`
}

/** Una petición a la portada. */
export async function obtenerPortadaSacatuentrada() {
  const html = await descargarTexto(SACATUENTRADA_URL)
  return parsearPortada(html)
}

/**
 * Dos peticiones más (detalle + entradas) para completar una obra que vamos a
 * crear. Solo se llama para obras sin pareja en Neon. Fail-soft por campo: si
 * una página falla, la obra sigue con lo que tenga de la portada.
 */
export async function completarObra(obra) {
  const completa = { ...obra, sinopsis: '', hora: null, sesiones: 0 }
  try {
    Object.assign(completa, parsearDetalle(await descargarTexto(obra.urlDetalle)))
  } catch (err) {
    console.warn(`sacatuentrada: sin detalle de ${obra.slug}: ${err.message}`)
  }
  if (obra.urlCompra) {
    try {
      Object.assign(completa, parsearEntradas(await descargarTexto(obra.urlCompra)))
    } catch (err) {
      console.warn(`sacatuentrada: sin sesión de ${obra.slug}: ${err.message}`)
    }
  }
  return completa
}

// ———————————————————————————————————————————————————————————————————————————
// Emparejamiento con las filas de Neon (puro; el llamador trae las filas).
// ———————————————————————————————————————————————————————————————————————————

function esTeatroCentro(lugar) {
  const k = claveTitulo(lugar)
  return k === 'teatro centro' || k.includes('teatro municipal centro')
}

/**
 * Empareja cada obra con una fila de `eventos_usuario` en cuatro niveles,
 * siempre acotado a la misma fecha y al Teatro Municipal Centro (el único
 * lugar de esta taquilla): (0) ya es nuestra (origen_externo_id = id de la
 * obra); (1) `titulosEquivalentes`; (2) `titulosAproximados`; (3) si en esa
 * fecha y lugar queda EXACTAMENTE una fila sin emparejar, es ella — con
 * `nivel: 'fecha-lugar'` para que el llamador lo marque como revisable.
 * Una fila solo puede emparejarse con una obra (las ya usadas se excluyen),
 * y las obras se recorren en el orden de la portada, así que el paraguas
 * "CETAN 2026: Certamen…" del 26-sep no se lleva la obra de ese día: la
 * obra empareja por título antes de llegar al nivel 3. Verificado con los
 * datos reales del 2026-09-22 (7/7: 4 equivalentes, 2 aproximados, 1 por
 * fecha y lugar).
 *
 * `filas`: [{ id, titulo, fecha (YYYY-MM-DD), lugar, origen_externo_id, … }].
 * Devuelve { emparejadas: [{obra, fila, nivel}], sinPareja: [obra] }.
 */
export function emparejarObrasConFilas(obras, filas) {
  const usadas = new Set()
  const emparejadas = []
  const sinPareja = []
  const NIVELES = [
    ['propia', (o, f) => f.origen_externo_id === idDeObra(o)],
    [
      'equivalente',
      (o, f) =>
        titulosEquivalentes(claveTitulo(o.rotulo), claveTitulo(f.titulo)) ||
        titulosEquivalentes(claveTitulo(o.titulo), claveTitulo(f.titulo)),
    ],
    ['aproximado', (o, f) => titulosAproximados(claveTitulo(o.titulo), claveTitulo(f.titulo))],
  ]
  for (const obra of obras) {
    const candidatas = filas.filter(
      (f) => !usadas.has(f.id) && f.fecha === obra.fecha && esTeatroCentro(f.lugar),
    )
    let pareja = null
    for (const [nivel, prueba] of NIVELES) {
      const fila = candidatas.find((f) => prueba(obra, f))
      if (fila) {
        pareja = { obra, fila, nivel }
        break
      }
    }
    if (!pareja && candidatas.length === 1) {
      pareja = { obra, fila: candidatas[0], nivel: 'fecha-lugar' }
    }
    if (pareja) {
      usadas.add(pareja.fila.id)
      emparejadas.push(pareja)
    } else {
      sinPareja.push(obra)
    }
  }
  return { emparejadas, sinPareja }
}
