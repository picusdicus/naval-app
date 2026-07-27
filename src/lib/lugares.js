// Resuelve el nombre del lugar de un evento (evento.lugar, solo texto) a unas
// coordenadas, buscándolo en el directorio de comercios/sitios (comercios.json,
// generado desde Google Places — incluye teatros, casas de cultura,
// polideportivos… con lat/lng). Así la ficha de evento puede pintar un mapa real
// sin que los eventos guarden coordenadas propias.
//
// El emparejamiento es por tokens significativos: "Salida en el Polideportivo
// Municipal" case con "Polideportivo Municipal El Pijorro". Plazas, parques y
// calles no son POIs de Places y no matchean (la ficha cae al enlace de Google
// Maps). Módulo "limpio" (sin JSX), como gaceta.js / tarifasDestacados.js.

import comercios from '../data/comercios.json'

// Plazas, parques y espacios públicos donde se celebran eventos y que no son
// POIs de Google Places (no están en comercios.json). Curados a mano con
// coordenadas de OpenStreetMap/Nominatim; añadir aquí los que vayan saliendo
// en la agenda. Van ANTES que el directorio en el índice para ganar los
// empates de puntuación.
const LUGARES_FIJOS = [
  { nombre: 'Plaza de Francisco Sandoval', lat: 40.2906258, lng: -4.0163167 },
  { nombre: 'Plaza de Segovia', lat: 40.2876685, lng: -4.0142827 },
  { nombre: 'Plaza de la Veracruz', lat: 40.2881244, lng: -4.0147148 },
  { nombre: 'Parque de San Sebastián', lat: 40.2874484, lng: -4.0204771 },
]

// Palabras de relleno que no aportan a la identificación del lugar.
const VACIAS = new Set(['en', 'el', 'la', 'los', 'las', 'de', 'del', 'y', 'a', 'al', 'salida'])

// Normaliza a tokens: minúsculas, sin acentos, alfanuméricos, ≥3 chars y no vacías.
function tokens(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !VACIAS.has(t))
}

// Índice precalculado: lugares fijos primero, luego los sitios del directorio
// con coordenadas numéricas.
const INDICE = [...LUGARES_FIJOS, ...comercios]
  .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
  .map((c) => ({ comercio: c, toks: new Set(tokens(c.nombre)) }))

// Devuelve { lat, lng, nombre } del sitio que mejor casa con el lugar, o null.
// Exige que un lado sea subconjunto del otro y ≥2 tokens en común, para no
// enganchar por una sola palabra genérica ("Centro", "Plaza"…).
export function coordsDeLugar(lugar) {
  const q = new Set(tokens(lugar))
  if (q.size === 0) return null

  let mejor = null
  let mejorScore = 0
  for (const { comercio, toks } of INDICE) {
    let overlap = 0
    for (const t of q) if (toks.has(t)) overlap++
    if (overlap < 2) continue
    const subconjunto = overlap === q.size || overlap === toks.size
    if (subconjunto && overlap > mejorScore) {
      mejor = comercio
      mejorScore = overlap
    }
  }
  return mejor ? { lat: mejor.lat, lng: mejor.lng, nombre: mejor.nombre } : null
}
