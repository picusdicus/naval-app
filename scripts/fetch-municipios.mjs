// Regenera src/data/municipios.json a partir del diccionario oficial de
// municipios del INE (Instituto Nacional de Estadística), que se publica cada
// año en un .xlsx:
//
//   npm run fetch:municipios            # último año conocido (AÑO_DEFECTO)
//   npm run fetch:municipios -- 2027    # otro año
//
// El JSON alimenta los desplegables Provincia → Municipio del formulario de
// eventos (/panel, eventos de ámbito 'otro') y la validación en servidor de
// api/admin/eventos.js: un municipio que no esté aquí no se guarda.
//
// Sin dependencias: el .xlsx es un zip con XML dentro. Se lee el directorio
// central del zip, se inflan (deflate crudo) las dos partes que interesan
// (sharedStrings.xml y sheet1.xml) y se parsean con expresiones regulares —
// el fichero del INE es plano y estable (columnas CODAUTO, CPRO, CMUN, DC,
// NOMBRE), no hace falta un parser de hojas de cálculo completo.
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

const AÑO_DEFECTO = 25
const año = String(process.argv[2] ?? AÑO_DEFECTO).slice(-2)
const URL_INE = `https://www.ine.es/daco/daco42/codmun/diccionario${año}.xlsx`
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destino = resolve(raiz, 'src/data/municipios.json')

// Nombres oficiales de las provincias por código INE (CPRO). No van en el
// diccionario de municipios (solo trae el código), y son estables.
export const PROVINCIAS = {
  '01': 'Araba/Álava', '02': 'Albacete', '03': 'Alicante/Alacant', '04': 'Almería',
  '05': 'Ávila', '06': 'Badajoz', '07': 'Illes Balears', '08': 'Barcelona',
  '09': 'Burgos', '10': 'Cáceres', '11': 'Cádiz', '12': 'Castellón/Castelló',
  '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña', '16': 'Cuenca',
  '17': 'Girona', '18': 'Granada', '19': 'Guadalajara', '20': 'Gipuzkoa',
  '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León',
  '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid',
  '29': 'Málaga', '30': 'Murcia', '31': 'Navarra', '32': 'Ourense',
  '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas', '36': 'Pontevedra',
  '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria', '40': 'Segovia',
  '41': 'Sevilla', '42': 'Soria', '43': 'Tarragona', '44': 'Teruel',
  '45': 'Toledo', '46': 'Valencia/València', '47': 'Valladolid', '48': 'Bizkaia',
  '49': 'Zamora', '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla',
}

/** Extrae una entrada del zip por nombre, leyendo el directorio central. */
function entradaDelZip(zip, nombre) {
  // End of central directory: firma 0x06054b50, buscada desde el final.
  let eocd = zip.length - 22
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error('No parece un zip (sin directorio central).')
  const entradas = zip.readUInt16LE(eocd + 10)
  let p = zip.readUInt32LE(eocd + 16)
  for (let i = 0; i < entradas; i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error('Directorio central corrupto.')
    const metodo = zip.readUInt16LE(p + 10)
    const tamComprimido = zip.readUInt32LE(p + 20)
    const tamNombre = zip.readUInt16LE(p + 28)
    const tamExtra = zip.readUInt16LE(p + 30)
    const tamComentario = zip.readUInt16LE(p + 32)
    const offsetLocal = zip.readUInt32LE(p + 42)
    const nombreEntrada = zip.toString('utf8', p + 46, p + 46 + tamNombre)
    if (nombreEntrada === nombre) {
      // Cabecera local: el tamaño del nombre/extra puede diferir del central.
      const n = zip.readUInt16LE(offsetLocal + 26)
      const e = zip.readUInt16LE(offsetLocal + 28)
      const inicio = offsetLocal + 30 + n + e
      const datos = zip.subarray(inicio, inicio + tamComprimido)
      if (metodo === 0) return datos
      if (metodo === 8) return inflateRawSync(datos)
      throw new Error(`Método de compresión ${metodo} no soportado en ${nombre}.`)
    }
    p += 46 + tamNombre + tamExtra + tamComentario
  }
  throw new Error(`El zip no contiene ${nombre}.`)
}

const desescapar = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/** Cadenas compartidas del libro, en orden de índice. */
function cadenasCompartidas(xml) {
  const cadenas = []
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    // Un <si> puede llevar varios <t> (texto enriquecido); se concatenan.
    cadenas.push(desescapar([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')))
  }
  return cadenas
}

/** Filas de la hoja como arrays de celdas (A, B, C…), ya resueltas a texto. */
function filasDeLaHoja(xml, cadenas) {
  const filas = []
  for (const fila of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const celdas = []
    for (const c of fila[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const columna = c[1].charCodeAt(0) - 65
      const esCompartida = /t="s"/.test(c[2])
      const v = c[3]?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? ''
      celdas[columna] = esCompartida ? cadenas[Number(v)] : desescapar(v)
    }
    filas.push(celdas)
  }
  return filas
}

/**
 * El INE escribe el artículo detrás: "Iglesuela del Cid, La". Para el
 * desplegable se devuelve al principio: "La Iglesuela del Cid". Solo se
 * reordena si lo que va tras la coma es un artículo (evita tocar nombres
 * bilingües con coma como "Ares, l'/Ares del Maestre" — hoy no existen, pero
 * la regla es conservadora a propósito).
 */
export function nombreLegible(nombre) {
  const m = nombre.match(/^(.*), (El|La|Los|Las|L'|Es|Sa|Ses|Els|Les|Lo|A|O|As|Os)$/i)
  if (!m) return nombre
  const articulo = m[2]
  return articulo.endsWith("'") ? `${articulo}${m[1]}` : `${articulo} ${m[1]}`
}

async function main() {
  console.log(`Descargando ${URL_INE}…`)
  const respuesta = await fetch(URL_INE, { headers: { 'User-Agent': 'Mozilla/5.0 (naval-app fetch-municipios)' } })
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} al descargar el diccionario del INE.`)
  const zip = Buffer.from(await respuesta.arrayBuffer())

  const cadenas = cadenasCompartidas(entradaDelZip(zip, 'xl/sharedStrings.xml').toString('utf8'))
  const filas = filasDeLaHoja(entradaDelZip(zip, 'xl/worksheets/sheet1.xml').toString('utf8'), cadenas)

  // Fila de cabeceras: la primera cuyas celdas contengan CPRO y NOMBRE.
  const iCabecera = filas.findIndex((f) => f.includes('CPRO') && f.includes('NOMBRE'))
  if (iCabecera < 0) throw new Error('No encuentro la fila de cabeceras (CPRO/NOMBRE): ¿cambió el formato del INE?')
  const cab = filas[iCabecera]
  const colPro = cab.indexOf('CPRO')
  const colMun = cab.indexOf('CMUN')
  const colNombre = cab.indexOf('NOMBRE')

  const municipios = []
  for (const f of filas.slice(iCabecera + 1)) {
    const cpro = String(f[colPro] ?? '').padStart(2, '0')
    const cmun = String(f[colMun] ?? '').padStart(3, '0')
    const nombre = String(f[colNombre] ?? '').trim()
    if (!PROVINCIAS[cpro] || !nombre) continue
    municipios.push({ codigo: cpro + cmun, provincia: cpro, nombre: nombreLegible(nombre) })
  }
  if (municipios.length < 8000) throw new Error(`Solo ${municipios.length} municipios: el fichero no es el esperado.`)

  municipios.sort((a, b) => a.provincia.localeCompare(b.provincia) || a.nombre.localeCompare(b.nombre, 'es'))

  // Formato compacto (el JSON se sirve al navegador): provincias por código y
  // municipios como [codigoINE, nombre]; la provincia son los 2 primeros
  // dígitos del código.
  const salida = {
    fuente: URL_INE,
    generado: new Date().toISOString().slice(0, 10),
    provincias: PROVINCIAS,
    municipios: municipios.map((m) => [m.codigo, m.nombre]),
  }
  writeFileSync(destino, JSON.stringify(salida) + '\n')
  const porProvincia = new Set(municipios.map((m) => m.provincia)).size
  console.log(`Escrito ${destino}: ${municipios.length} municipios en ${porProvincia} provincias.`)
}

const esEjecucionDirecta = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (esEjecucionDirecta) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
