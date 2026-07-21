// Búsqueda del directorio con "intención": mapea términos de cocina, plato o
// tipo de local (hamburguesas, sushi, pizza, tapas, café, comer…) a comercios
// relevantes aunque la palabra no aparezca literalmente en el nombre.
//
// Los datos actuales de comercios no traen el tipo de cocina (campo `cocina`
// vacío), así que el mapeo se apoya en: palabras clave del nombre, el subtipo
// (restaurant/bar/cafe) y, como red de seguridad, la categoría restauración
// (para sugerir alternativas cuando no hay una coincidencia exacta).

export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

// Intenciones de búsqueda. `terminos`: lo que teclea el vecino (ya sin acentos).
// `keywords`: subcadenas a buscar en el nombre. `subtipos`/`categorias`: aciertos
// por tipo de local o categoría. `especifico`: si es una cocina/plato concreto
// (si no hay coincidencias, se ofrecen restaurantes como alternativa).
const INTENCIONES = [
  // --- Cocinas / platos específicos ---
  { terminos: ['hamburguesa', 'burger', 'burguer'], keywords: ['burger', 'burguer', 'hamburgues'], especifico: true },
  { terminos: ['pizza', 'pizzeria', 'italiana', 'italiano'], keywords: ['pizz', 'italian'], especifico: true },
  { terminos: ['sushi', 'japones', 'japonesa', 'nikkei', 'ramen'], keywords: ['sushi', 'japon', 'nikkei', 'ramen'], especifico: true },
  { terminos: ['kebab', 'kebap', 'doner', 'durum', 'turco', 'turca', 'shawarma'], keywords: ['kebab', 'kebap', 'doner', 'durum', 'turc', 'shawarma'], especifico: true },
  { terminos: ['china', 'chino', 'asiatica', 'asiatico', 'wok', 'oriental'], keywords: ['chin', 'asiat', 'wok', 'zhang', 'oriental'], especifico: true },
  { terminos: ['mexicana', 'mexicano', 'tacos', 'burrito', 'texmex', 'tex-mex'], keywords: ['mexic', 'taco', 'burrito', 'tex'], especifico: true },
  { terminos: ['india', 'indio', 'curry', 'tandoori'], keywords: ['indi', 'curry', 'tandoor'], especifico: true },
  { terminos: ['marisco', 'mariscos', 'pescado', 'pescados'], keywords: ['marisc', 'pescad', 'seafood'], especifico: true },
  { terminos: ['asador', 'parrilla', 'brasa', 'carne', 'carnes', 'steak', 'chuleton'], keywords: ['asador', 'parrilla', 'brasa', 'steak', 'grill', 'carnic'], especifico: true },
  { terminos: ['vegetariano', 'vegetariana', 'vegano', 'vegana', 'saludable', 'healthy'], keywords: ['veget', 'vegan', 'saludable', 'healthy'], especifico: true },
  { terminos: ['montaditos', 'montadito', 'bocadillo', 'bocadillos', 'sandwich', 'pincho', 'pinchos'], keywords: ['montadito', 'bocadillo', 'sandwich', 'pincho', 'pintx'], especifico: true },
  { terminos: ['churros', 'churreria', 'churro'], keywords: ['churr'], especifico: true },
  { terminos: ['helado', 'helados', 'heladeria'], keywords: ['helad', 'ice cream'], subtipos: ['ice_cream'], especifico: true },

  // --- Intenciones genéricas (el resultado es directamente el conjunto) ---
  { terminos: ['tapas', 'tapa', 'tapear', 'cañas', 'canas', 'cerveza', 'cervezas', 'copas', 'vino', 'vinos', 'taberna'], keywords: ['taberna', 'cerveceria', 'bodega', 'tapas', 'pintx', 'txoko', 'vino', 'cava'], subtipos: ['bar'], especifico: false },
  { terminos: ['bar', 'bares', 'pub'], keywords: ['bar ', 'taberna', 'cerveceria', 'pub'], subtipos: ['bar', 'pub'], especifico: false },
  { terminos: ['cafe', 'cafeteria', 'cafeterias', 'desayuno', 'desayunar', 'desayunos', 'merendar', 'merienda', 'cafes', 'coffee'], keywords: ['cafeteria', 'cafe', 'coffee', 'reposteria', 'desayuno'], subtipos: ['cafe'], especifico: false },
  { terminos: ['comer', 'cenar', 'restaurante', 'restaurantes', 'comida', 'almorzar', 'almuerzo', 'menu', 'menu del dia', 'donde comer'], categorias: ['restauracion'], especifico: false },

  // Barbería: por keyword en nombre/tipoDisplay ("Barber", "Barbería"), para no
  // arrastrar todas las peluquerías.
  { terminos: ['barberia', 'barbero', 'barbershop'], keywords: ['barber'], especifico: false },

  // --- Ocio y cultura ---
  { terminos: ['teatro', 'teatros'], keywords: ['teatro', 'theatre'], especifico: true, categorias: ['ocio_cultura'] },
  { terminos: ['cine', 'cines'], keywords: ['cine', 'cinema'], especifico: true, categorias: ['ocio_cultura'] },
  { terminos: ['parque', 'parques', 'parque tematico'], keywords: ['parque'], especifico: true, categorias: ['ocio_cultura'] },
  { terminos: ['ocio', 'entretenimiento', 'diversión'], categorias: ['ocio_cultura'], especifico: false },

  // --- Educación ---
  { terminos: ['colegio', 'colegios', 'escuela', 'escuelas', 'primaria', 'primarias'], keywords: ['colegio', 'escuela', 'primaria'], especifico: true, categorias: ['educacion'] },
  { terminos: ['academia', 'academias'], keywords: ['academia'], especifico: true, categorias: ['educacion'] },
  { terminos: ['danza', 'baile', 'ballet'], keywords: ['danza', 'baile', 'ballet'], especifico: true, categorias: ['educacion'] },
  { terminos: ['autoescuela', 'escuela de manejo', 'carnet', 'conducir'], keywords: ['autoescuela'], especifico: true, categorias: ['educacion'] },
  { terminos: ['idiomas', 'ingles', 'frances', 'aleman', 'clases', 'curso', 'cursos'], keywords: ['idiomas', 'english', 'francais', 'deutsch'], especifico: true, categorias: ['educacion'] },
  { terminos: ['guarderia', 'guarderia infantil', 'preescolar'], keywords: ['guarderia', 'preescolar', 'daycare'], especifico: true, categorias: ['educacion'] },

  // --- Deporte ---
  { terminos: ['padel', 'pádel', 'tenis'], keywords: ['padel', 'pádel', 'tenis'], especifico: true, categorias: ['deporte'] },
  { terminos: ['piscina', 'piscinas', 'natacion'], keywords: ['piscina', 'natacion', 'swimming'], especifico: true, categorias: ['deporte'] },
  { terminos: ['boxeo', 'gimnasia', 'artes marciales'], keywords: ['boxeo', 'boxing', 'gimnasia'], especifico: true, categorias: ['deporte'] },
  { terminos: ['gym', 'gimnasio', 'gimnasios', 'fitness'], keywords: ['gym', 'gimnasio', 'fitness', 'entrenamiento'], especifico: true, categorias: ['deporte'] },
  { terminos: ['deportes', 'entrenamiento'], categorias: ['deporte'], especifico: false },
]

// Comprueba si el término aparece en la consulta como palabra completa, con
// plural opcional (así "tapa" casa "tapas" pero "bar" NO casa "barbería").
function terminoEnConsulta(consulta, termino) {
  const t = termino.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
  return new RegExp('\\b' + t + '(?:es|s)?\\b').test(consulta)
}

function intencionPara(consulta) {
  return INTENCIONES.find((i) => i.terminos.some((t) => terminoEnConsulta(consulta, t))) || null
}

// Texto sobre el que se busca: el nombre del comercio + su etiqueta descriptiva
// de Google Places (tipoDisplay, p. ej. "Restaurante turco", "Barbería",
// "Gasolinera"). Así "turco", "gasolinera" o "clínica dental" encuentran el
// comercio aunque esas palabras no estén en el nombre.
function textoBuscable(comercio) {
  return normalizar(`${comercio.nombre || ''} ${comercio.tipoDisplay || ''}`)
}

// Coincidencia por texto. Para consultas cortas (< 4) exige palabra completa
// (así "bar" casa "Bar El..." pero no "Barbería" ni "barato"); para consultas
// más largas basta con que aparezca como subcadena.
function textoCoincide(textoNorm, q) {
  if (q.length >= 4) return textoNorm.includes(q)
  const t = q.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
  return new RegExp('\\b' + t + '\\b').test(textoNorm)
}

function coincideIntencion(comercio, intencion) {
  const n = textoBuscable(comercio)
  if (intencion.keywords && intencion.keywords.some((k) => n.includes(k))) return true
  if (intencion.subtipos && intencion.subtipos.includes(comercio.subtipo)) return true
  if (intencion.categorias && intencion.categorias.includes(comercio.categoria)) return true
  return false
}

// Busca en `base` (comercios ya filtrados por categoría/cocina) según la
// consulta. Devuelve la lista a mostrar y si son sugerencias (alternativas).
export function buscarDirectorio(base, consulta) {
  const q = normalizar(consulta)
  if (!q) return { termino: '', lista: base, esSugerencia: false }

  const intencion = intencionPara(q)

  // Coincidencias: por nombre + tipoDisplay siempre; por intención si la hay.
  const principales = base.filter((c) => {
    if (textoCoincide(textoBuscable(c), q)) return true
    if (intencion && coincideIntencion(c, intencion)) return true
    return false
  })

  if (principales.length > 0) {
    return { termino: consulta.trim(), lista: principales, esSugerencia: false }
  }

  // Sin coincidencias: si era una cocina/plato concreto, sugiere restaurantes.
  if (intencion && intencion.especifico) {
    const alternativas = base.filter((c) => c.categoria === 'restauracion')
    if (alternativas.length > 0) {
      return { termino: consulta.trim(), lista: alternativas, esSugerencia: true }
    }
  }

  return { termino: consulta.trim(), lista: [], esSugerencia: false }
}
