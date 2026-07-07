import MIcon from '../MIcon.jsx'

// Símbolo de Material Symbols por cada categoría de evento
// (definida en src/lib/eventos.js).
export const SIMBOLO_EVENTO = {
  fiestas: 'celebration',
  cultura: 'theater_comedy',
  gastronomia: 'restaurant',
  mercado: 'storefront',
  deporte: 'directions_run',
  infantil: 'toys',
}

export function IconoEvento({ categoria, className = '', fill = false }) {
  return <MIcon name={SIMBOLO_EVENTO[categoria] || 'event'} className={className} fill={fill} />
}
