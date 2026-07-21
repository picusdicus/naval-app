// Gradientes de "cartel" del sistema La Gaceta. Un cartel es el bloque visual
// de un evento o comercio: si tiene imagen real (imagen_url de Neon/Blob) se
// usa la foto; si no, el fallback es un degradado de esta paleta + la trama
// diagonal (.gz-trama / .gz-trama-clara en index.css).
//
// Módulo "limpio" (sin JSX/JSON), como tarifasDestacados.js: importable desde
// cualquier lado sin arrastrar dependencias de navegador.

export const GRADIENTES_CARTEL = {
  terracota: ['#c94f34', '#7a2d1e'],
  bosque: ['#2b3a34', '#12201b'],
  ocre: ['#c68a2e', '#7c4f16'],
  ambar: ['#e0932a', '#7c4a10'],
  azul: ['#3a4e86', '#161d33'],
  granate: ['#8a3a58', '#4a1a2e'],
  salvia: ['#4a5b41', '#232e1f'],
  pardo: ['#8a6d3a', '#4a3416'],
}

// Los gradientes con arranque claro (ocre, ambar, terracota) llevan trama
// oscura; los de arranque oscuro llevan trama clara. Clase CSS a aplicar
// junto al gradiente.
export const TRAMA_POR_GRADIENTE = {
  terracota: 'gz-trama',
  bosque: 'gz-trama-clara',
  ocre: 'gz-trama',
  ambar: 'gz-trama',
  azul: 'gz-trama-clara',
  granate: 'gz-trama-clara',
  salvia: 'gz-trama-clara',
  pardo: 'gz-trama',
}

// Categorías de eventos (las de eventos.json + fuentes externas) → gradiente.
// Las que no estén aquí caen en terracota, el acento de la casa.
export const GRADIENTE_POR_CATEGORIA = {
  cultura: 'bosque',
  fiestas: 'terracota',
  gastronomia: 'ocre',
  mercado: 'ambar',
  infantil: 'granate',
  deporte: 'azul',
}

// Devuelve { fondo, trama } listos para style/className. `clave` puede ser
// una categoría de evento o directamente el nombre de un gradiente.
export function cartelDe(clave) {
  const nombre =
    GRADIENTE_POR_CATEGORIA[clave] || (GRADIENTES_CARTEL[clave] ? clave : 'terracota')
  const [desde, hasta] = GRADIENTES_CARTEL[nombre]
  return {
    fondo: `linear-gradient(135deg, ${desde}, ${hasta})`,
    trama: TRAMA_POR_GRADIENTE[nombre],
  }
}
