// Imágenes ilustrativas para los eventos sin cartel propio (Wikimedia Commons,
// licencias libres verificadas al descargar). Cada categoría mapea a un ARRAY
// de variantes para que varios eventos sin imagen seguidos no repitan foto
// (con una sola por categoría, los 158 eventos de fiestas salían clonados —
// ese fue el motivo del revert de ago-2026; ahora la selección es estable por
// id, ver imagenEvento()). Cada entrada lleva su crédito para la atribución
// que exigen las licencias CC BY / CC BY-SA; `pos` ajusta el encuadre
// (object-position) cuando conviene; `soloTarjeta` marca resoluciones justas
// (~640-750px) que valen para la tarjeta del muro pero no para el héroe de la
// ficha de detalle.
//
// Módulo "limpio" (sin React): lo importa también destacados.js.

export const IMAGENES_EVENTO = {
  // Pool general de cultura (fachadas culturales reales de Navalcarnero).
  cultura: [
    { src: '/img/eventos/cultura/1.jpg', credito: 'Tyne & Wear Archives & Museums, sin restricciones' },
    { src: '/img/eventos/cultura/2.jpg', credito: 'Zarateman, CC0' },
    { src: '/img/eventos/cultura/3.jpg', credito: 'Zarateman, CC0' },
    { src: '/img/eventos/cultura/4.jpg', credito: 'Zarateman, CC0' },
  ],
  // Sub-pools de cultura, elegidos por subcategoría o palabra clave del título.
  concierto: [
    { src: '/img/eventos/concierto/1.jpg', credito: 'Shixart1985, CC BY 2.0' },
    { src: '/img/eventos/concierto/2.jpg', credito: 'Carlos Teixidor Cadenas, CC BY-SA 4.0' },
  ],
  cine: [{ src: '/img/eventos/cine/1.jpg', credito: 'Bdx, CC0' }],
  fiestas: [
    { src: '/img/eventos/fiestas/1.jpg', pos: '50% 25%', credito: 'Henry Sattink Rath, CC BY-SA 3.0' },
    { src: '/img/eventos/fiestas/2.jpg', credito: 'Lolalatorre, CC BY-SA 3.0' },
    { src: '/img/eventos/fiestas/3.jpg', credito: 'Javier Pérez Montes, CC BY-SA 4.0' },
    { src: '/img/eventos/fiestas/4.jpg', credito: 'Diario de Madrid, CC BY 4.0' },
    { src: '/img/eventos/fiestas/5.jpg', credito: 'Dirección General de Turismo, Comunidad de Madrid, CC BY 3.0' },
  ],
  infantil: [
    { src: '/img/eventos/infantil/1.jpg', credito: 'Jorge Royan, CC BY-SA 3.0' },
    { src: '/img/eventos/infantil/2.jpg', credito: 'Diario de Madrid, CC BY 4.0' },
    { src: '/img/eventos/infantil/3.jpg', credito: 'Diario de Madrid, CC BY 4.0' },
    { src: '/img/eventos/infantil/4.jpg', credito: 'Zarateman, CC0' },
    { src: '/img/eventos/infantil/5.jpg', credito: 'Diario de Madrid, CC BY 4.0', soloTarjeta: true },
  ],
  deporte: [
    { src: '/img/eventos/deporte/1.jpg', credito: 'Shixart1985, CC BY 2.0' },
    { src: '/img/eventos/deporte/2.jpg', credito: 'Cadiznoticias, CC BY-SA 2.0' },
    { src: '/img/eventos/deporte/3.jpg', credito: 'Cadiznoticias, CC BY-SA 2.0' },
    { src: '/img/eventos/deporte/4.jpg', credito: 'Diario de Madrid, CC BY 4.0' },
  ],
  gastronomia: [
    { src: '/img/eventos/gastronomia/1.jpg', credito: 'Brian Snelson, CC BY 2.0' },
    { src: '/img/eventos/gastronomia/2.jpg', credito: 'Juan Emilio Prades Bel, CC BY-SA 4.0' },
  ],
  mercado: [
    { src: '/img/eventos/mercado/1.jpg', credito: 'Acabashi, CC BY-SA 4.0' },
    { src: '/img/eventos/mercado/2.jpg', credito: 'Benjamín Núñez González, CC BY-SA 4.0' },
  ],
  educacion: [{ src: '/img/eventos/educacion/1.jpg', credito: 'Benjamín Núñez González, CC BY-SA 4.0' }],
  ayudas: [{ src: '/img/eventos/ayudas/1.jpg', credito: 'Diario de Madrid, CC BY 4.0' }],
  talleres: [{ src: '/img/eventos/talleres/1.jpg', credito: 'Rayhanphotos, CC BY-SA 4.0' }],
  mayores: [{ src: '/img/eventos/mayores/1.jpg', credito: 'Diario de Madrid, CC BY 4.0' }],
  empleo: [{ src: '/img/eventos/empleo/1.jpg', credito: 'Diario de Madrid, CC BY 4.0', soloTarjeta: true }],
  general: [{ src: '/img/eventos/general/1.jpg', credito: 'Dirección General de Turismo, Comunidad de Madrid, CC BY 3.0' }],
}

// Hash determinista y barato (djb2) para que cada evento elija SIEMPRE la
// misma variante entre recargas y dispositivos — nunca aleatoria por render.
function hashDe(texto) {
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0
  return h
}

// Pool de variantes para un evento. Dentro de "cultura" se afina por
// subcategoría (la de Neon: musica/cine) o, en su defecto, por palabra clave
// del título — un concierto debe enseñar un concierto, no una fachada.
function poolDe(evento) {
  if (evento.categoria === 'cultura') {
    if (evento.subcategoria === 'musica') return IMAGENES_EVENTO.concierto
    if (evento.subcategoria === 'cine') return IMAGENES_EVENTO.cine
    const t = (evento.titulo || '').toLowerCase()
    if (/(concierto|música|musica|jazz|banda|coro)/.test(t)) return IMAGENES_EVENTO.concierto
    if (/(cine|película|pelicula|proyección|proyeccion|film)/.test(t)) return IMAGENES_EVENTO.cine
    return IMAGENES_EVENTO.cultura
  }
  return IMAGENES_EVENTO[evento.categoria] || IMAGENES_EVENTO.general
}

/**
 * Elige la imagen de un evento.
 *  - Con foto propia (campo `imagen`, p. ej. el cartel real): {src, real: true}.
 *  - Sin ella: una ilustrativa del pool de su categoría, estable por id del
 *    evento → {src, pos?, credito, real: false}.
 *  - `paraHeroe: true` (ficha de detalle) evita las variantes `soloTarjeta`
 *    (resolución insuficiente a tamaño de héroe); si el pool entero es
 *    soloTarjeta, devuelve null y la ficha cae al degradado de siempre.
 */
export function imagenEvento(evento, { paraHeroe = false } = {}) {
  if (evento.imagen && evento.imagen.trim()) return { src: evento.imagen, real: true }
  const pool = poolDe(evento)
  if (!pool || pool.length === 0) return null
  const semilla = hashDe(String(evento.id ?? evento.titulo ?? ''))
  let elegida = pool[semilla % pool.length]
  if (paraHeroe && elegida.soloTarjeta) {
    const aptas = pool.filter((v) => !v.soloTarjeta)
    if (aptas.length === 0) return null
    elegida = aptas[semilla % aptas.length]
  }
  return { src: elegida.src, pos: elegida.pos, credito: elegida.credito, real: false }
}

// Lista de créditos únicos para la atribución en la página de eventos.
export const CREDITOS_FOTOS = [
  ...new Set(
    Object.values(IMAGENES_EVENTO)
      .flat()
      .map((i) => i.credito),
  ),
]
