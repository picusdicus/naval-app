import { IconFlag, IconFilm, IconCoffee, IconBasket, IconRun, IconBalloon, IconCalendar } from '../icons.jsx'

// Icono React por cada categoría de evento (definida en src/lib/eventos.js).
export const ICONO_EVENTO = {
  fiestas: IconFlag,
  cultura: IconFilm,
  gastronomia: IconCoffee,
  mercado: IconBasket,
  deporte: IconRun,
  infantil: IconBalloon,
}

export function IconoEvento({ categoria, ...props }) {
  const Icon = ICONO_EVENTO[categoria] || IconCalendar
  return <Icon {...props} />
}
