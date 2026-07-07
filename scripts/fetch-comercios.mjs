// Descarga los comercios de Navalcarnero desde OpenStreetMap (Overpass API)
// y los normaliza en src/data/comercios.json.
//
// Uso: npm run fetch:comercios
//
// Nota: Overpass devuelve 406 si falta la cabecera User-Agent.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { categoriaDe } from '../src/lib/categorias.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(__dirname, '../src/data/comercios.json')

// Endpoints de Overpass en orden de preferencia; si uno da 429/504 se prueba el siguiente.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const QUERY = `[out:json][timeout:90];
area["name"="Navalcarnero"]["boundary"="administrative"]->.a;
(
  nwr["shop"](area.a);
  nwr["amenity"~"restaurant|cafe|bar|pub|fast_food|ice_cream|pharmacy|clinic|doctors|dentist|bank|atm|fuel|marketplace|post_office"](area.a);
);
out tags center;`

function coords(el) {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lng: el.lon }
  }
  if (el.center) return { lat: el.center.lat, lng: el.center.lon }
  return null
}

function direccion(t) {
  const calle = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ')
  return calle || t['addr:full'] || ''
}

function cocina(t) {
  if (!t.cuisine) return []
  return t.cuisine.split(';').map((c) => c.trim()).filter(Boolean)
}

async function consultar() {
  let ultimoError
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'User-Agent': 'NavalcarneroApp/0.1 (proyecto vecinal)',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: QUERY }),
      })
      if (res.ok) return res.json()
      ultimoError = new Error(`${endpoint} respondió ${res.status}`)
      console.warn(`  ${endpoint} → ${res.status}, probando siguiente…`)
    } catch (err) {
      ultimoError = err
      console.warn(`  ${endpoint} → ${err.message}, probando siguiente…`)
    }
  }
  throw ultimoError || new Error('Overpass no disponible')
}

async function main() {
  console.log('Consultando Overpass para Navalcarnero…')
  const json = await consultar()
  const elementos = json.elements || []

  const comercios = []
  for (const el of elementos) {
    const t = el.tags || {}
    if (!t.name) continue
    const c = coords(el)
    if (!c) continue

    comercios.push({
      id: `${el.type}/${el.id}`,
      nombre: t.name,
      categoria: categoriaDe(t),
      subtipo: t.shop || t.amenity || '',
      cocina: cocina(t),
      lat: c.lat,
      lng: c.lng,
      direccion: direccion(t),
      telefono: t.phone || t['contact:phone'] || '',
      web: t.website || t['contact:website'] || '',
      horario: t.opening_hours || '',
    })
  }

  comercios.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  mkdirSync(dirname(SALIDA), { recursive: true })
  writeFileSync(SALIDA, JSON.stringify(comercios, null, 2) + '\n', 'utf8')

  const porCat = {}
  for (const c of comercios) porCat[c.categoria] = (porCat[c.categoria] || 0) + 1

  console.log(`Guardados ${comercios.length} comercios en ${SALIDA}`)
  console.log('Por categoría:', porCat)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
