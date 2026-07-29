// Etiquetas en plural e iconos (Material Symbols) de los subtipos del
// directorio, para las tarjetas de subcategoría de cada categoría.
// Módulo "limpio" (sin JSX/JSON), como categorias.js.

import subtiposExtra from '../data/subtipos-extra.js'

const SUBTIPO_BASE = {
  // Alimentación
  supermarket: { nombre: 'Supermercados', icono: 'shopping_cart' },
  bakery: { nombre: 'Panaderías', icono: 'bakery_dining' },
  butcher: { nombre: 'Carnicerías', icono: 'restaurant' },
  deli: { nombre: 'Charcuterías', icono: 'lunch_dining' },
  greengrocer: { nombre: 'Fruterías', icono: 'nutrition' },
  marketplace: { nombre: 'Mercados', icono: 'storefront' },
  convenience: { nombre: 'Tiendas de barrio', icono: 'local_convenience_store' },
  alcohol: { nombre: 'Bodegas y licores', icono: 'liquor' },
  confectionery: { nombre: 'Dulces', icono: 'cake' },

  // Restauración
  restaurant: { nombre: 'Restaurantes', icono: 'restaurant' },
  bar: { nombre: 'Bares y tabernas', icono: 'local_bar' },
  cafe: { nombre: 'Cafeterías', icono: 'local_cafe' },
  fast_food: { nombre: 'Comida rápida', icono: 'fastfood' },
  pizza: { nombre: 'Pizzerías', icono: 'local_pizza' },
  sandwich: { nombre: 'Bocadillerías', icono: 'lunch_dining' },
  ice_cream: { nombre: 'Heladerías', icono: 'icecream' },
  pastry: { nombre: 'Pastelerías', icono: 'cake' },

  // Salud
  doctors: { nombre: 'Consultas y clínicas', icono: 'medical_services' },
  pharmacy: { nombre: 'Farmacias', icono: 'local_pharmacy' },
  dentist: { nombre: 'Dentistas', icono: 'dentistry' },
  physiotherapist: { nombre: 'Fisioterapia', icono: 'healing' },
  optician: { nombre: 'Ópticas', icono: 'eyeglasses' },
  veterinary: { nombre: 'Veterinarios', icono: 'pets' },
  hospital: { nombre: 'Hospitales', icono: 'local_hospital' },

  // Belleza
  hairdresser: { nombre: 'Peluquerías', icono: 'content_cut' },
  beauty: { nombre: 'Estética', icono: 'spa' },
  barber: { nombre: 'Barberías', icono: 'content_cut' },
  tattoo: { nombre: 'Tatuajes y piercing', icono: 'brush' },

  // Moda y complementos
  clothes: { nombre: 'Ropa', icono: 'checkroom' },
  shoes: { nombre: 'Zapaterías', icono: 'steps' },
  jewelry: { nombre: 'Joyerías', icono: 'diamond' },

  // Hogar y otros
  furniture: { nombre: 'Muebles', icono: 'chair' },
  houseware: { nombre: 'Menaje y hogar', icono: 'home' },
  doityourself: { nombre: 'Ferreterías y bricolaje', icono: 'hardware' },
  books: { nombre: 'Librerías y papelerías', icono: 'menu_book' },
  florist: { nombre: 'Floristerías', icono: 'local_florist' },
  garden_centre: { nombre: 'Jardinería', icono: 'yard' },
  electronics: { nombre: 'Electrónica y móviles', icono: 'devices' },
  toys: { nombre: 'Jugueterías', icono: 'toys' },
  sports: { nombre: 'Deportes', icono: 'sports_soccer' },
  gift: { nombre: 'Regalos', icono: 'card_giftcard' },
  pet: { nombre: 'Mascotas', icono: 'pets' },

  // Servicios
  car_repair: { nombre: 'Talleres', icono: 'car_repair' },
  car_wash: { nombre: 'Lavado de coches', icono: 'local_car_wash' },
  car: { nombre: 'Concesionarios', icono: 'directions_car' },
  fuel: { nombre: 'Gasolineras', icono: 'local_gas_station' },
  courier: { nombre: 'Transportes y mensajería', icono: 'local_shipping' },
  laundry: { nombre: 'Lavanderías', icono: 'local_laundry_service' },
  dry_cleaning: { nombre: 'Tintorerías', icono: 'local_laundry_service' },
  bank: { nombre: 'Bancos', icono: 'account_balance' },
  atm: { nombre: 'Cajeros', icono: 'local_atm' },
  post_office: { nombre: 'Correos', icono: 'local_post_office' },
  travel_agency: { nombre: 'Agencias de viajes', icono: 'travel_explore' },
  hotel: { nombre: 'Alojamiento', icono: 'hotel' },
  parking: { nombre: 'Aparcamientos', icono: 'local_parking' },
  storage: { nombre: 'Trasteros', icono: 'inventory_2' },
  locksmith: { nombre: 'Cerrajerías', icono: 'lock' },
  tailor: { nombre: 'Sastrerías y arreglos', icono: 'styler' },
  pet_care: { nombre: 'Cuidado de mascotas', icono: 'pets' },
  library: { nombre: 'Bibliotecas', icono: 'local_library' },
  funeral: { nombre: 'Funerarias', icono: 'local_florist' },
  service: { nombre: 'Otros servicios', icono: 'miscellaneous_services' },

  // Servicios profesionales
  estate_agent: { nombre: 'Inmobiliarias', icono: 'real_estate_agent' },
  lawyer: { nombre: 'Abogados', icono: 'gavel' },
  consultant: { nombre: 'Asesorías y gestorías', icono: 'work' },
  accountant: { nombre: 'Contabilidad', icono: 'calculate' },
  insurance: { nombre: 'Seguros', icono: 'shield' },
  notary: { nombre: 'Notarías', icono: 'gavel' },
  architect: { nombre: 'Arquitectos', icono: 'architecture' },
  plumber: { nombre: 'Fontaneros', icono: 'plumbing' },
  fontaneria: { nombre: 'Fontaneros', icono: 'plumbing' },
  electrician: { nombre: 'Electricistas', icono: 'electrical_services' },
  electricidad: { nombre: 'Electricistas', icono: 'electrical_services' },
  builder: { nombre: 'Reformas', icono: 'construction' },
  reformas: { nombre: 'Reformas', icono: 'construction' },
  piscinas: { nombre: 'Piscinas', icono: 'pool' },
  cerrajeria: { nombre: 'Cerrajerías', icono: 'key' },
  pintura: { nombre: 'Pintores', icono: 'format_paint' },
  photographer: { nombre: 'Fotógrafos', icono: 'photo_camera' },
  printing: { nombre: 'Imprenta y artes gráficas', icono: 'print' },
  marketing: { nombre: 'Marketing y publicidad', icono: 'campaign' },
  moving: { nombre: 'Mudanzas', icono: 'local_shipping' },
  computer: { nombre: 'Informática', icono: 'computer' },
  employment: { nombre: 'Agencias de empleo', icono: 'badge' },

  // Deporte
  gym: { nombre: 'Gimnasios', icono: 'fitness_center' },
  sports_centre: { nombre: 'Centros deportivos', icono: 'sports_handball' },
  swimming_pool: { nombre: 'Piscinas', icono: 'pool' },
  stadium: { nombre: 'Estadios', icono: 'stadium' },
  martial_arts: { nombre: 'Artes marciales', icono: 'sports_martial_arts' },
  yoga: { nombre: 'Yoga', icono: 'self_improvement' },
  climbing: { nombre: 'Escalada', icono: 'hiking' },
  tennis: { nombre: 'Tenis y pádel', icono: 'sports_tennis' },

  // Ocio y cultura
  venue: { nombre: 'Salas y espacios', icono: 'celebration' },
  theatre: { nombre: 'Teatros', icono: 'theater_comedy' },
  cinema: { nombre: 'Cines', icono: 'movie' },
  museum: { nombre: 'Museos', icono: 'museum' },
  gallery: { nombre: 'Galerías de arte', icono: 'palette' },
  cultural_centre: { nombre: 'Centros culturales', icono: 'account_balance' },
  nightclub: { nombre: 'Ocio nocturno', icono: 'nightlife' },
  park: { nombre: 'Parques', icono: 'park' },
  playground: { nombre: 'Parques infantiles', icono: 'attractions' },
  attraction: { nombre: 'Magia', icono: 'photo_camera' },
  casino: { nombre: 'Salones de juego', icono: 'casino' },

  // Educación
  school: { nombre: 'Colegios y escuelas', icono: 'school' },
  academy: { nombre: 'Academias', icono: 'auto_stories' },
  kindergarten: { nombre: 'Guarderías', icono: 'child_care' },
  driving_school: { nombre: 'Autoescuelas', icono: 'directions_car' },
  language_school: { nombre: 'Idiomas', icono: 'translate' },
  dance_school: { nombre: 'Danza', icono: 'music_note' },
  music_school: { nombre: 'Música', icono: 'music_note' },
  art_school: { nombre: 'Arte', icono: 'palette' },
  university: { nombre: 'Universidades', icono: 'school' },

  // Genérico
  shop: { nombre: 'Otras tiendas', icono: 'storefront' },

  // Alimentación
  comida_preparada: { nombre: 'Comida preparada', icono: 'takeout_dining' },
  seafood: { nombre: 'Pescaderías', icono: 'set_meal' },

  // Salud
  nursing_home: { nombre: 'Residencias de mayores', icono: 'elderly' },

  // Servicios
  tobacco: { nombre: 'Estancos', icono: 'smoking_rooms' },
  lottery: { nombre: 'Loterías y apuestas', icono: 'casino' },

  // Belleza
  pet_grooming: { nombre: 'Peluquerías caninas', icono: 'pets' },

  // Ocio y cultura
  bookshop: { nombre: 'Librerías', icono: 'menu_book' },
  stationery: { nombre: 'Papelerías', icono: 'edit_note' },

  // Deporte
  pilates: { nombre: 'Pilates', icono: 'self_improvement' },
  cycling: { nombre: 'Ciclismo', icono: 'directions_bike' },
}

// Los base + los creados desde el panel superadmin (subtipos-extra.js).
export const SUBTIPO_INFO = { ...SUBTIPO_BASE, ...subtiposExtra }

// Etiqueta e icono de un subtipo; si no está en el diccionario, formatea el
// identificador de forma razonable para no romper la tarjeta.
export function infoSubtipo(subtipo) {
  if (SUBTIPO_INFO[subtipo]) return SUBTIPO_INFO[subtipo]
  const limpio = (subtipo || '').replace(/[_-]+/g, ' ').trim()
  return {
    nombre: limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : 'Otros',
    icono: 'storefront',
  }
}
