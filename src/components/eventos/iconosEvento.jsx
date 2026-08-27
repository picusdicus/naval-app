import MIcon from '../MIcon.jsx'
import {
  IconArmchair,
  IconBooks,
  IconBriefcase,
  IconBuildingChurch,
  IconCalendar,
  IconConfetti,
  IconGlassChampagne,
  IconHeartHandshake,
  IconMasksTheater,
  IconMoodKid,
  IconRun,
  IconSchool,
  IconShoppingBag,
  IconTool,
} from '@tabler/icons-react'
import { iconoDeCategoria } from '../../lib/eventos.js'

// Componente Tabler por cada slug 'ti-*' que devuelve iconoDeCategoria()
// (src/lib/eventos.js — ahí vive la decisión categoría/subcategoría → slug;
// aquí solo se resuelve el componente, que es JSX y no puede ir en ese módulo).
const TABLER_POR_SLUG = {
  'ti-building-church': IconBuildingChurch,
  'ti-confetti': IconConfetti,
  'ti-masks-theater': IconMasksTheater,
  'ti-books': IconBooks,
  'ti-glass-champagne': IconGlassChampagne,
  'ti-shopping-bag': IconShoppingBag,
  'ti-run': IconRun,
  'ti-mood-kid': IconMoodKid,
  'ti-tool': IconTool,
  'ti-armchair': IconArmchair,
  'ti-heart-handshake': IconHeartHandshake,
  'ti-briefcase': IconBriefcase,
  'ti-school': IconSchool,
  'ti-calendar': IconCalendar,
}

// Icono Tabler de la categoría/subcategoría (watermark de la tarjeta sin imagen).
export function IconoCategoriaTabler({ categoria, subcategoria, ...props }) {
  const Icono = TABLER_POR_SLUG[iconoDeCategoria(categoria, subcategoria)] || IconCalendar
  return <Icono {...props} />
}

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
