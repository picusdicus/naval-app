import MIcon from '../MIcon.jsx'

// Símbolo de Material Symbols por cada categoría del directorio
// (definida en src/lib/categorias.js).
export const SIMBOLO_CATEGORIA = {
  alimentacion: 'storefront',
  restauracion: 'restaurant',
  salud: 'medical_services',
  belleza: 'content_cut',
  hogar: 'chair',
  servicios: 'build',
  servicios_prof: 'handyman',
  deporte: 'fitness_center',
  ocio_cultura: 'theater_comedy',
  educacion: 'school',
}

export function IconoCategoria({ categoria, className = '', fill = false }) {
  return (
    <MIcon name={SIMBOLO_CATEGORIA[categoria] || 'location_on'} className={className} fill={fill} />
  )
}
