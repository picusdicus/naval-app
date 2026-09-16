// Definición única de una ficha de comercio válida para el alta MANUAL desde
// el panel superadmin (tab Comercios). La ejecuta el formulario antes de
// enviar y la vuelve a ejecutar api/super/comercios-alta.js: el cliente nunca
// se da por bueno. Módulo "limpio" (sin JSX ni JSON) — lo importan Edge y
// navegador, como eventoForm.js.
//
// La ficha resultante replica CAMPO A CAMPO la forma de una entrada de
// comercios.json generada por scripts/fetch-comercios.mjs desde Google Places
// (id, nombre, categoria, subtipo, cocina, lat, lng, direccion, telefono, web,
// mapsUrl, horario, rating, totalReviews, precioNivel, tipoDisplay,
// descripcion, cerradoTemporal, atributos) más las tres columnas de
// procedencia de servicios-locales.json (fuente, fuenteCategoria,
// fuenteSubcategoria). Lo único que nunca se rellena a mano es rating y
// totalReviews: son reseñas de Google y no existen fuera de Places.

export const LIMITES_COMERCIO = {
  nombre: 100,
  direccion: 200,
  telefono: 30,
  web: 300,
  mapsUrl: 500,
  horario: 600,
  tipoDisplay: 60,
  descripcion: 500,
  cocina: 6,
}

// Atributos que Places devuelve como booleanos (fase 2 de fetch-comercios.mjs)
// y que la ficha pública sabe pintar (ETIQUETA_ATRIBUTO en ComercioDetalle).
export const ATRIBUTOS_COMERCIO = {
  terraza: 'Terraza',
  paraLlevar: 'Para llevar',
  aDomicilio: 'A domicilio',
  reservas: 'Reservas',
  vegetariano: 'Opción vegetariana',
  accesible: 'Accesible',
  tarjeta: 'Acepta tarjeta',
  soloEfectivo: 'Solo efectivo',
}

// Valores de `precioNivel` tal como los deja formatPriceLevel() del fetch
// (PRICE_LEVEL_MODERATE → "MODERATE"); '' = sin dato.
export const NIVELES_PRECIO = [
  { valor: '', texto: 'Sin dato' },
  { valor: 'FREE', texto: 'Gratis' },
  { valor: 'INEXPENSIVE', texto: '€ · Económico' },
  { valor: 'MODERATE', texto: '€€ · Moderado' },
  { valor: 'EXPENSIVE', texto: '€€€ · Caro' },
  { valor: 'VERY_EXPENSIVE', texto: '€€€€ · Muy caro' },
]

// Prefijo de las fichas de alta manual. Las de la guía municipal llevan
// 'guia-municipal' y las aprobadas desde la bandeja de altas 'alta-vecinal':
// tres orígenes distinguibles en el JSON sin tocar la UI (que no lee `fuente`).
export const FUENTE_ALTA_MANUAL = 'alta-manual'

export const VALORES_INICIALES_COMERCIO = {
  nombre: '',
  categoria: '',
  subtipo: '',
  tipoDisplay: '',
  direccion: '',
  telefono: '',
  web: '',
  mapsUrl: '',
  lat: '',
  lng: '',
  horario: '',
  descripcion: '',
  precioNivel: '',
  cocina: [],
  atributos: {},
  cerradoTemporal: false,
}

const TELEFONO_REGEX = /^[0-9+()\s.-]{0,30}$/
const COCINA_REGEX = /^[a-z][a-z0-9_-]{1,30}$/
const NIVELES_VALIDOS = new Set(NIVELES_PRECIO.map((n) => n.valor))

const texto = (v) => (typeof v === 'string' ? v.trim() : '')
const urlValida = (v) => /^https?:\/\/.+/i.test(v)

function coordenada(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(String(valor).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/**
 * Valida una ficha de alta manual. Devuelve `{campo: mensaje}`; vacío si es
 * válida. `categorias`/`subtipos` son los conjuntos de claves admitidas (la
 * taxonomía base + la creada desde el panel).
 */
export function validarComercio(valores, { categorias, subtipos }) {
  const errores = {}
  const L = LIMITES_COMERCIO

  const nombre = texto(valores.nombre)
  if (!nombre) errores.nombre = 'El nombre es obligatorio.'
  else if (nombre.length > L.nombre) errores.nombre = `Máximo ${L.nombre} caracteres.`

  if (!categorias.has(valores.categoria)) errores.categoria = 'Elige una categoría.'
  if (!subtipos.has(valores.subtipo)) errores.subtipo = 'Elige una subcategoría.'

  const direccion = texto(valores.direccion)
  if (!direccion) errores.direccion = 'La dirección es obligatoria.'
  else if (direccion.length > L.direccion) errores.direccion = `Máximo ${L.direccion} caracteres.`

  const telefono = texto(valores.telefono)
  if (telefono && !TELEFONO_REGEX.test(telefono)) errores.telefono = 'Solo dígitos, espacios, +, paréntesis, puntos o guiones.'

  const web = texto(valores.web)
  if (web && (web.length > L.web || !urlValida(web))) errores.web = 'Debe empezar por http:// o https://.'

  const mapsUrl = texto(valores.mapsUrl)
  if (mapsUrl && (mapsUrl.length > L.mapsUrl || !urlValida(mapsUrl))) {
    errores.mapsUrl = 'Debe ser un enlace completo de Google Maps (https://…).'
  }

  const lat = coordenada(valores.lat)
  const lng = coordenada(valores.lng)
  if (Number.isNaN(lat) || (lat !== null && (lat < -90 || lat > 90))) errores.lat = 'Latitud inválida (-90 a 90).'
  if (Number.isNaN(lng) || (lng !== null && (lng < -180 || lng > 180))) errores.lng = 'Longitud inválida (-180 a 180).'
  // Sin las dos, el comercio no se pinta en el mapa: se piden juntas o ninguna.
  if (!errores.lat && !errores.lng && (lat === null) !== (lng === null)) {
    errores[lat === null ? 'lat' : 'lng'] = 'Indica latitud y longitud, o deja las dos vacías.'
  }

  if (texto(valores.horario).length > L.horario) errores.horario = `Máximo ${L.horario} caracteres.`
  if (texto(valores.tipoDisplay).length > L.tipoDisplay) errores.tipoDisplay = `Máximo ${L.tipoDisplay} caracteres.`
  if (texto(valores.descripcion).length > L.descripcion) errores.descripcion = `Máximo ${L.descripcion} caracteres.`

  if (!NIVELES_VALIDOS.has(valores.precioNivel ?? '')) errores.precioNivel = 'Nivel de precio desconocido.'

  const cocina = Array.isArray(valores.cocina) ? valores.cocina : null
  if (!cocina) errores.cocina = 'Formato inválido.'
  else if (cocina.length > L.cocina) errores.cocina = `Máximo ${L.cocina} tipos de cocina.`
  else if (cocina.some((c) => typeof c !== 'string' || !COCINA_REGEX.test(c))) errores.cocina = 'Tipo de cocina inválido.'

  const atributos = valores.atributos
  if (!atributos || typeof atributos !== 'object' || Array.isArray(atributos)) errores.atributos = 'Formato inválido.'
  else if (Object.keys(atributos).some((k) => !(k in ATRIBUTOS_COMERCIO))) errores.atributos = 'Atributo desconocido.'

  if (typeof (valores.cerradoTemporal ?? false) !== 'boolean') errores.cerradoTemporal = 'Formato inválido.'

  return errores
}

// "Peluquería Loli & Co." → "peluqueria-loli-co" (mismo slug que usa la
// bandeja de altas para que los ids de los dos caminos sean homogéneos).
export function slugComercio(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

// Id `local/<categoria>-<slug>` único frente a `existentes` (sufijo -2, -3…).
export function idLocalUnico(categoria, nombre, existentes) {
  const base = `local/${categoria}-${slugComercio(nombre)}`
  if (!existentes.has(base)) return base
  let n = 2
  while (existentes.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// Igualdad de nombres para detectar duplicados: sin tildes ni signos, espacios
// colapsados. No es el matcher difuso del alta vecinal — al superadmin se le
// avisa del duplicado exacto y decide.
export function claveNombreComercio(nombre) {
  return slugComercio(nombre).replace(/-/g, ' ')
}

/**
 * Construye la ficha con la forma exacta de comercios.json a partir de los
 * valores YA validados. Solo `true` sobrevive en `atributos` (como en Places:
 * un atributo ausente y uno en false son lo mismo).
 */
export function construirFichaComercio(valores, id, fuente = FUENTE_ALTA_MANUAL) {
  const atributos = {}
  for (const clave of Object.keys(ATRIBUTOS_COMERCIO)) {
    if (valores.atributos?.[clave] === true) atributos[clave] = true
  }
  return {
    id,
    nombre: texto(valores.nombre),
    categoria: valores.categoria,
    subtipo: valores.subtipo,
    cocina: [...new Set(valores.cocina || [])],
    lat: coordenada(valores.lat),
    lng: coordenada(valores.lng),
    direccion: texto(valores.direccion),
    telefono: texto(valores.telefono),
    web: texto(valores.web),
    mapsUrl: texto(valores.mapsUrl),
    horario: texto(valores.horario),
    rating: null,
    totalReviews: null,
    precioNivel: valores.precioNivel || '',
    tipoDisplay: texto(valores.tipoDisplay),
    descripcion: texto(valores.descripcion),
    cerradoTemporal: valores.cerradoTemporal === true,
    atributos,
    fuente,
    fuenteCategoria: null,
    fuenteSubcategoria: null,
  }
}
