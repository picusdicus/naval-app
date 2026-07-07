// Mapeo de tags de OpenStreetMap (shop=* / amenity=*) a categorías amigables
// en español. Usado tanto por el script de descarga como por la interfaz.

export const CATEGORIAS = {
  alimentacion: { id: 'alimentacion', nombre: 'Alimentación', color: '#C1633D' },
  restauracion: { id: 'restauracion', nombre: 'Restauración', color: '#7A2E3E' },
  salud: { id: 'salud', nombre: 'Salud', color: '#3B7A57' },
  belleza: { id: 'belleza', nombre: 'Belleza', color: '#B5559A' },
  hogar: { id: 'hogar', nombre: 'Hogar y otros', color: '#8A6D2F' },
  servicios: { id: 'servicios', nombre: 'Servicios', color: '#4E6A8A' },
  servicios_prof: { id: 'servicios_prof', nombre: 'Servicios profesionales', color: '#2E6E7A' },
}

const SHOP_A_CATEGORIA = {
  supermarket: 'alimentacion',
  convenience: 'alimentacion',
  greengrocer: 'alimentacion',
  bakery: 'alimentacion',
  butcher: 'alimentacion',
  seafood: 'alimentacion',
  deli: 'alimentacion',
  pastry: 'alimentacion',
  beverages: 'alimentacion',
  chemist: 'salud',
  optician: 'salud',
  hairdresser: 'belleza',
  beauty: 'belleza',
  perfumery: 'belleza',
  cosmetics: 'belleza',
  furniture: 'hogar',
  garden_centre: 'hogar',
  florist: 'hogar',
  hardware: 'hogar',
  doityourself: 'hogar',
  houseware: 'hogar',
}

const AMENITY_A_CATEGORIA = {
  restaurant: 'restauracion',
  fast_food: 'restauracion',
  cafe: 'restauracion',
  bar: 'restauracion',
  pub: 'restauracion',
  ice_cream: 'restauracion',
  pharmacy: 'salud',
  clinic: 'salud',
  doctors: 'salud',
  dentist: 'salud',
  bank: 'servicios',
  fuel: 'servicios',
  marketplace: 'alimentacion',
  post_office: 'servicios',
  atm: 'servicios',
}

// Devuelve el id de categoría para un conjunto de tags OSM.
// Si no encaja en nada conocido, cae en 'servicios'.
export function categoriaDe(tags = {}) {
  if (tags.shop && SHOP_A_CATEGORIA[tags.shop]) return SHOP_A_CATEGORIA[tags.shop]
  if (tags.amenity && AMENITY_A_CATEGORIA[tags.amenity]) return AMENITY_A_CATEGORIA[tags.amenity]
  if (tags.shop) return 'servicios'
  if (tags.amenity) return 'servicios'
  return 'servicios'
}

export const LISTA_CATEGORIAS = Object.values(CATEGORIAS)
