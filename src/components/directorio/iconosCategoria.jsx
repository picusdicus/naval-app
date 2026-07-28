import MIcon from '../MIcon.jsx'
import categoriasExtra from '../../data/categorias-extra.js'

// Símbolo de Material Symbols por cada categoría del directorio
// (definida en src/lib/categorias.js).
const SIMBOLO_BASE = {
  alimentacion: 'storefront',
  restauracion: 'restaurant',
  salud: 'medical_services',
  belleza: 'content_cut',
  moda: 'checkroom',
  hogar: 'chair',
  servicios: 'build',
  servicios_prof: 'handyman',
  deporte: 'fitness_center',
  ocio_cultura: 'theater_comedy',
  educacion: 'school',
}

// Las categorías creadas desde el panel llevan su icono en categorias-extra.js.
export const SIMBOLO_CATEGORIA = {
  ...SIMBOLO_BASE,
  ...Object.fromEntries(
    Object.entries(categoriasExtra).map(([id, def]) => [id, def.icono || 'storefront']),
  ),
}

export function IconoCategoria({ categoria, className = '', fill = false }) {
  return (
    <MIcon name={SIMBOLO_CATEGORIA[categoria] || 'location_on'} className={className} fill={fill} />
  )
}
