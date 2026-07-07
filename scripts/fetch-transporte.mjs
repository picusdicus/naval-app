// Descarga el GTFS oficial de autobuses interurbanos del CRTM (datos.crtm.es,
// dataset 885399f83408473c8d815e40c5e702b7, google_transit_M89.zip), filtra
// las líneas que paran en Navalcarnero y genera src/data/horarios-bus.json
// con los horarios reales por sentido y tipo de día (laborable/sábado/festivo).
//
// Uso: npm run fetch:transporte
//      npm run fetch:transporte -- ruta/a/un/zip/local  (evita re-descargar)
//
// Nota: el zip pesa ~75 MB (stop_times.txt son ~107 MB descomprimidos).

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(__dirname, '../src/data/horarios-bus.json')

const URL_GTFS =
  'https://www.arcgis.com/sharing/rest/content/items/885399f83408473c8d815e40c5e702b7/data'

// Término municipal de Navalcarnero (casco y urbanizaciones cercanas).
const BBOX = { latMin: 40.255, latMax: 40.325, lonMin: -4.09, lonMax: -3.96 }

// Líneas solicitadas originalmente para el proyecto. Se comprueban de forma
// explícita contra las paradas de Navalcarnero: el GTFS demuestra que NO
// prestan servicio en el municipio (son del corredor A-6: Torrelodones,
// Galapagar y Las Rozas), por lo que el filtro efectivo es geográfico.
const LINEAS_SOLICITADAS = ['629', '631', '632']

// --- CSV -------------------------------------------------------------------

// Parser CSV mínimo con soporte de campos entrecomillados.
function parseLinea(linea) {
  const campos = []
  let actual = ''
  let entreComillas = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (entreComillas) {
      if (ch === '"') {
        if (linea[i + 1] === '"') {
          actual += '"'
          i++
        } else entreComillas = false
      } else actual += ch
    } else if (ch === '"') entreComillas = true
    else if (ch === ',') {
      campos.push(actual)
      actual = ''
    } else actual += ch
  }
  campos.push(actual)
  return campos
}

// Itera un archivo CSV del zip como objetos {columna: valor}.
function* filas(zip, nombre) {
  const entry = zip.getEntry(nombre)
  if (!entry) throw new Error(`Falta ${nombre} en el GTFS`)
  const texto = entry.getData().toString('utf8')
  let inicio = 0
  let cabecera = null
  while (inicio < texto.length) {
    let fin = texto.indexOf('\n', inicio)
    if (fin === -1) fin = texto.length
    const linea = texto.slice(inicio, fin).replace(/\r$/, '')
    inicio = fin + 1
    if (!linea) continue
    const campos = parseLinea(linea)
    if (!cabecera) {
      cabecera = campos.map((c) => c.replace(/^﻿/, ''))
      continue
    }
    const obj = {}
    for (let i = 0; i < cabecera.length; i++) obj[cabecera[i]] = campos[i] ?? ''
    yield obj
  }
}

// --- utilidades ------------------------------------------------------------

function hoyAAAAMMDD() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

// "HH:MM:SS" GTFS (puede ser >= 24h) -> "HH:MM" normalizado a 0-23h.
function normalizarHora(hms) {
  const [h, m] = hms.split(':')
  const hora = parseInt(h, 10) % 24
  return `${String(hora).padStart(2, '0')}:${m}`
}

function aMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// --- programa principal ----------------------------------------------------

async function main() {
  const zipLocal = process.argv[2]
  let buffer
  if (zipLocal && existsSync(zipLocal)) {
    console.log(`Usando GTFS local: ${zipLocal}`)
    buffer = readFileSync(zipLocal)
  } else {
    console.log('Descargando GTFS de interurbanos del CRTM (~75 MB)…')
    const res = await fetch(URL_GTFS, {
      headers: { 'User-Agent': 'NavalcarneroApp/0.1 (proyecto vecinal)' },
    })
    if (!res.ok) throw new Error(`La descarga del GTFS respondió ${res.status}`)
    buffer = Buffer.from(await res.arrayBuffer())
  }
  const zip = new AdmZip(buffer)

  // 1. Paradas dentro de Navalcarnero.
  const paradas = new Map() // stop_id -> nombre
  for (const s of filas(zip, 'stops.txt')) {
    const lat = parseFloat(s.stop_lat)
    const lon = parseFloat(s.stop_lon)
    if (lat > BBOX.latMin && lat < BBOX.latMax && lon > BBOX.lonMin && lon < BBOX.lonMax) {
      paradas.set(s.stop_id, s.stop_name)
    }
  }
  console.log(`Paradas en Navalcarnero: ${paradas.size}`)

  // 2. Rutas (todas; se filtran tras cruzar con las paradas).
  const rutas = new Map() // route_id -> {numero, nombre}
  for (const r of filas(zip, 'routes.txt')) {
    rutas.set(r.route_id, { numero: r.route_short_name, nombre: r.route_long_name })
  }

  // 3. Calendarios vigentes hoy -> tipos de día.
  const hoy = hoyAAAAMMDD()
  const servicios = new Map() // service_id -> ['laborable'|'sabado'|'festivo', ...]
  for (const c of filas(zip, 'calendar.txt')) {
    if (c.start_date > hoy || c.end_date < hoy) continue
    const tipos = []
    if ([c.monday, c.tuesday, c.wednesday, c.thursday, c.friday].some((v) => v === '1')) {
      tipos.push('laborable')
    }
    if (c.saturday === '1') tipos.push('sabado')
    if (c.sunday === '1') tipos.push('festivo')
    if (tipos.length) servicios.set(c.service_id, tipos)
  }
  console.log(`Servicios vigentes hoy: ${servicios.size}`)

  // 4. Viajes de servicios vigentes.
  const viajes = new Map() // trip_id -> {routeId, tipos, direccion, destino}
  for (const t of filas(zip, 'trips.txt')) {
    const tipos = servicios.get(t.service_id)
    if (!tipos) continue
    viajes.set(t.trip_id, {
      routeId: t.route_id,
      tipos,
      direccion: t.direction_id || '0',
      destino: t.trip_headsign || '',
    })
  }

  // 5. stop_times: salidas desde paradas de Navalcarnero.
  //    Clave ruta|dirección -> por parada, horarios por tipo de día.
  const grupos = new Map()
  let filasLeidas = 0
  for (const st of filas(zip, 'stop_times.txt')) {
    filasLeidas++
    const nombreParada = paradas.get(st.stop_id)
    if (!nombreParada) continue
    const viaje = viajes.get(st.trip_id)
    if (!viaje) continue

    const clave = `${viaje.routeId}|${viaje.direccion}`
    let grupo = grupos.get(clave)
    if (!grupo) {
      grupo = { routeId: viaje.routeId, direccion: viaje.direccion, destinos: new Map(), paradas: new Map() }
      grupos.set(clave, grupo)
    }
    grupo.destinos.set(viaje.destino, (grupo.destinos.get(viaje.destino) || 0) + 1)

    let parada = grupo.paradas.get(st.stop_id)
    if (!parada) {
      parada = { nombre: nombreParada, laborable: new Set(), sabado: new Set(), festivo: new Set() }
      grupo.paradas.set(st.stop_id, parada)
    }
    const hora = normalizarHora(st.departure_time)
    for (const tipo of viaje.tipos) parada[tipo].add(hora)
  }
  console.log(`Filas de stop_times procesadas: ${filasLeidas}`)

  // 6. Por ruta y sentido: la parada principal (más salidas) y sus horarios.
  const porRuta = new Map()
  for (const grupo of grupos.values()) {
    let principal = null
    let maxSalidas = 0
    for (const p of grupo.paradas.values()) {
      const total = p.laborable.size + p.sabado.size + p.festivo.size
      if (total > maxSalidas) {
        maxSalidas = total
        principal = p
      }
    }
    if (!principal) continue

    const destino =
      [...grupo.destinos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    const sentido = {
      destino,
      parada: principal.nombre,
      horarios: {
        laborable: [...principal.laborable].sort((a, b) => aMinutos(a) - aMinutos(b)),
        sabado: [...principal.sabado].sort((a, b) => aMinutos(a) - aMinutos(b)),
        festivo: [...principal.festivo].sort((a, b) => aMinutos(a) - aMinutos(b)),
      },
    }

    if (!porRuta.has(grupo.routeId)) porRuta.set(grupo.routeId, [])
    porRuta.get(grupo.routeId).push({ direccion: grupo.direccion, ...sentido })
  }

  const lineas = []
  for (const [routeId, sentidos] of porRuta.entries()) {
    const ruta = rutas.get(routeId)
    if (!ruta) continue
    sentidos.sort((a, b) => a.direccion.localeCompare(b.direccion))
    lineas.push({
      numero: ruta.numero,
      nombre: ruta.nombre,
      sentidos: sentidos.map(({ direccion, ...resto }) => resto),
    })
  }
  lineas.sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true }))

  // Filtro explícito de las líneas solicitadas (629/631/632) contra las
  // paradas de Navalcarnero, con su resultado documentado en la salida.
  const numerosConServicio = new Set(lineas.map((l) => l.numero))
  const sinServicio = []
  console.log('\nComprobación de las líneas solicitadas (629, 631, 632):')
  for (const numero of LINEAS_SOLICITADAS) {
    const ruta = [...rutas.values()].find((r) => r.numero === numero)
    if (numerosConServicio.has(numero)) {
      console.log(`  ${numero}: SÍ para en Navalcarnero — incluida.`)
    } else {
      sinServicio.push(numero)
      console.log(
        `  ${numero}: sin paradas en Navalcarnero${ruta ? ` (${ruta.nombre})` : ''} — excluida.`,
      )
    }
  }

  const salida = {
    fuente: 'CRTM – GTFS Red de Autobuses Interurbanos (datos.crtm.es)',
    actualizado: new Date().toISOString().slice(0, 10),
    nota:
      sinServicio.length > 0
        ? `Las líneas ${sinServicio.join(', ')} no prestan servicio en Navalcarnero según el GTFS oficial (corredor A-6); se incluyen las ${lineas.length} líneas con parada real en el municipio.`
        : undefined,
    lineas,
  }

  mkdirSync(dirname(SALIDA), { recursive: true })
  writeFileSync(SALIDA, JSON.stringify(salida, null, 2) + '\n', 'utf8')

  console.log(`\nGuardadas ${lineas.length} líneas en ${SALIDA}:`)
  for (const l of lineas) {
    const resumen = l.sentidos
      .map((s) => `${s.destino || 's/d'} (${s.horarios.laborable.length} lab.)`)
      .join(' / ')
    console.log(`  ${l.numero}: ${resumen}`)
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
