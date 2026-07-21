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

// Índice precalculado: solo los sitios con coordenadas numéricas.
const INDICE = comercios
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
