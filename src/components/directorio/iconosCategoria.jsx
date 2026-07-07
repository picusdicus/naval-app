import { IconStore, IconCoffee, IconStethoscope, IconScissors, IconTool, IconPin } from '../icons.jsx'

// Icono React por cada id de categoría (definido en src/lib/categorias.js).
export const ICONO_CATEGORIA = {
  alimentacion: IconStore,
  restauracion: IconCoffee,
  salud: IconStethoscope,
  belleza: IconScissors,
  hogar: IconTool,
  servicios: IconPin,
  servicios_prof: IconTool,
}

export function IconoCategoria({ categoria, ...props }) {
  const Icon = ICONO_CATEGORIA[categoria] || IconPin
  return <Icon {...props} />
}
