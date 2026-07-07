// Traducción de valores OSM `cuisine=*` a etiquetas en español.
// Se aplica en la interfaz para no tener que regenerar los datos al ampliarlo.

export const COCINA_LABEL = {
  burger: 'Hamburguesas',
  pizza: 'Pizzería',
  italian: 'Italiana',
  spanish: 'Española',
  regional: 'Cocina regional',
  tapas: 'Tapas',
  sushi: 'Sushi',
  japanese: 'Japonesa',
  chinese: 'China',
  asian: 'Asiática',
  kebab: 'Kebab',
  turkish: 'Turca',
  mediterranean: 'Mediterránea',
  seafood: 'Marisco',
  fish: 'Pescado',
  fusion: 'Fusión',
  coffee_shop: 'Cafetería',
  sandwich: 'Bocadillos',
  fast_food: 'Comida rápida',
  grill: 'Parrilla',
  barbecue: 'Parrilla',
  steak_house: 'Carnes a la brasa',
  international: 'Internacional',
  vegetarian: 'Vegetariana',
  vegan: 'Vegana',
  indian: 'India',
  mexican: 'Mexicana',
  american: 'Americana',
  french: 'Francesa',
  portuguese: 'Portuguesa',
  breakfast: 'Desayunos',
  ice_cream: 'Heladería',
  churro: 'Churrería',
  bakery: 'Panadería',
  chicken: 'Pollo asado',
  'tex-mex': 'Tex-Mex',
}

// Convierte un valor OSM en etiqueta legible; si no está en el diccionario,
// lo formatea de forma razonable (guiones/underscores a espacios, capitalizado).
export function etiquetaCocina(raw) {
  if (!raw) return ''
  if (COCINA_LABEL[raw]) return COCINA_LABEL[raw]
  const limpio = raw.replace(/[_-]+/g, ' ').trim()
  return limpio.charAt(0).toUpperCase() + limpio.slice(1)
}

// Devuelve la lista de etiquetas para un array de valores cuisine.
export function etiquetasCocina(cocina = []) {
  return cocina.map(etiquetaCocina)
}

// Tipo de local de restauración (amenity) cuando no hay cuisine.
const SUBTIPO_LABEL = {
  restaurant: 'Restaurante',
  bar: 'Bar',
  cafe: 'Cafetería',
  fast_food: 'Comida rápida',
  pub: 'Pub',
  ice_cream: 'Heladería',
}

// Texto de "tipo" a mostrar para un comercio: el tipo de cocina si existe,
// si no el tipo de local, y como último recurso el nombre de la categoría.
export function tipoComercio(comercio, nombreCategoria) {
  if (comercio.cocina && comercio.cocina.length) {
    return etiquetasCocina(comercio.cocina).join(' · ')
  }
  return SUBTIPO_LABEL[comercio.subtipo] || nombreCategoria || ''
}
