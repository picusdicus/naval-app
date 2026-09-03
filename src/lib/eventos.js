// Categorías de eventos + utilidades de fecha para la agenda vecinal.

export const CATEGORIAS_EVENTO = {
  fiestas: { id: 'fiestas', nombre: 'Fiestas', color: '#7A2E3E' },
  cultura: { id: 'cultura', nombre: 'Cultura', color: '#8A4327' },
  gastronomia: { id: 'gastronomia', nombre: 'Gastronomía', color: '#B5822B' },
  mercado: { id: 'mercado', nombre: 'Mercados', color: '#C1633D' },
  deporte: { id: 'deporte', nombre: 'Deporte', color: '#3B7A57' },
  infantil: { id: 'infantil', nombre: 'Infantil', color: '#B5559A' },
  talleres: { id: 'talleres', nombre: 'Talleres', color: '#9B5A7A' },
  // Categorías que solo llegan desde la tabla `actividades` de Neon (el CHECK
  // admite deporte|talleres|infantil|mayores|educacion|ayudas|empleo|general;
  // las tres primeras ya existían arriba como categorías de evento).
  mayores: { id: 'mayores', nombre: 'Mayores', color: '#6E5B8C' },
  educacion: { id: 'educacion', nombre: 'Educación', color: '#3E5F8A' },
  ayudas: { id: 'ayudas', nombre: 'Ayudas', color: '#2F6F6B' },
  empleo: { id: 'empleo', nombre: 'Empleo', color: '#5C6B4A' },
  general: { id: 'general', nombre: 'General', color: '#6E6459' },
}

export const LISTA_CATEGORIAS_EVENTO = Object.values(CATEGORIAS_EVENTO)

// Subcategorías DENTRO de 'cultura' (no son categorías hermanas a propósito:
// los temas de push 'cat:cultura', los filtros y el perfil de las orgs siguen
// funcionando como paraguas). Las rellena el webhook de Instagram
// (api/sync-instagram.js las importa de aquí) y el TYL TYL se fija a 'teatro'
// sin IA. Opcionales: un evento de cultura sin subcategoría clara la deja null.
export const SUBCATEGORIAS_CULTURA = {
  teatro: { id: 'teatro', nombre: 'Teatro' },
  cine: { id: 'cine', nombre: 'Cine' },
  musica: { id: 'musica', nombre: 'Música' },
  danza: { id: 'danza', nombre: 'Danza' },
  exposicion: { id: 'exposicion', nombre: 'Exposiciones' },
  otros: { id: 'otros', nombre: 'Otros' },
}

export const LISTA_SUBCATEGORIAS_CULTURA = Object.values(SUBCATEGORIAS_CULTURA)

// Subcategorías dentro de 'fiestas' (actos religiosos y similares que pueden
// filtrarse independientemente). Opcionales: un evento de fiestas sin subcategoría
// clara la deja null.
export const SUBCATEGORIAS_FIESTAS = {
  religiosa: { id: 'religiosa', nombre: 'Religiosa' },
}

export const LISTA_SUBCATEGORIAS_FIESTAS = Object.values(SUBCATEGORIAS_FIESTAS)

// Icono de la tarjeta sin imagen: slug de Tabler Icons ('ti-*') por
// categoría/subcategoría. Devuelve el nombre, no el componente — este módulo
// lo importan también handlers de API y debe seguir "limpio" (sin JSX); el
// mapeo slug → componente vive en src/components/eventos/iconosEvento.jsx.
// si algún día hace falta más finura (ajedrez, natación, teatro específico...),
// aquí es donde se añade una tercera capa mirando el título del evento — no
// antes: hoy los datos no lo justifican.
const ICONO_POR_CATEGORIA = {
  fiestas: 'ti-confetti',
  cultura: 'ti-books',
  gastronomia: 'ti-glass-champagne',
  mercado: 'ti-shopping-bag',
  deporte: 'ti-run',
  infantil: 'ti-mood-kid',
  talleres: 'ti-tool',
  mayores: 'ti-armchair',
  ayudas: 'ti-heart-handshake',
  empleo: 'ti-briefcase',
  educacion: 'ti-school',
  general: 'ti-calendar',
}

export function iconoDeCategoria(categoria, subcategoria) {
  // Tabler no tiene 'church' a secas: su icono de iglesia es 'building-church'.
  if (categoria === 'fiestas' && subcategoria === 'religiosa') return 'ti-building-church'
  if (categoria === 'cultura' && subcategoria === 'teatro') return 'ti-masks-theater'
  return ICONO_POR_CATEGORIA[categoria] || 'ti-calendar'
}

// Convierte 'YYYY-MM-DD' en Date local (sin desfase de zona horaria).
function aFecha(iso) {
  return new Date(`${iso}T00:00:00`)
}

export function formatearFechaCorta(iso) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(aFecha(iso))
}

export function formatearFechaLarga(iso) {
  const texto = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(aFecha(iso))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Día de la semana capitalizado: 'Martes'. Para las bandas/cabeceras del muro.
export function diaSemanaDe(iso) {
  return capitalizar(new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(aFecha(iso)))
}

// Mes capitalizado: 'Julio'.
export function mesDe(iso) {
  return capitalizar(new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(aFecha(iso)))
}

// Ámbito de un evento (issue #33): 'navalcarnero' (agenda local) u 'otro'
// (evento de una organización de aquí celebrado en otra población — solo se
// muestra en su ficha de comercio como portafolio). Los eventos estáticos de
// los JSON no traen el campo: se tratan como locales.
export const AMBITOS_EVENTO = ['navalcarnero', 'otro']

// "Móstoles (Madrid)" para un evento de ámbito 'otro'; "Madrid" a secas si
// municipio y provincia coinciden, y solo la población si el evento se guardó
// antes de existir `provincia`. Cadena vacía para eventos locales. No necesita
// el catálogo de municipios (src/lib/municipios.js, pesado): solo formatea.
export function textoPoblacion(evento) {
  if (evento?.ambito !== 'otro' || !evento.poblacion) return ''
  const { poblacion, provincia } = evento
  return provincia && provincia !== poblacion ? `${poblacion} (${provincia})` : poblacion
}

// Solo los eventos de Navalcarnero, para la agenda pública y los destacados.
// PerfilComercio NO debe usarla: su portafolio muestra también los de fuera.
export function soloAmbitoNavalcarnero(eventos) {
  return eventos.filter((e) => e.ambito !== 'otro')
}

// Eventos futuros (o de hoy) ordenados por fecha ascendente.
export function proximosEventos(eventos, limite) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const futuros = eventos
    .filter((e) => aFecha(e.fecha) >= hoy)
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.hora || '').localeCompare(b.hora || ''))
  return typeof limite === 'number' ? futuros.slice(0, limite) : futuros
}

// Eventos ya pasados, ordenados del más reciente al más antiguo (para el
// histórico de actividades culturales).
export function eventosPasados(eventos, limite) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const pasados = eventos
    .filter((e) => aFecha(e.fecha) < hoy)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.hora || '').localeCompare(a.hora || ''))
  return typeof limite === 'number' ? pasados.slice(0, limite) : pasados
}

// Agrupa eventos por día (YYYY-MM-DD), ordenados cronológicamente.
// Devuelve: [{ dia: 'YYYY-MM-DD', eventos: [...sorted by time] }, ...]
export function agruparEventosPorDia(eventos) {
  const agrupados = new Map()

  // Ordenar todos los eventos por fecha y hora primero
  const ordenados = [...eventos].sort((a, b) => {
    const cmp = (a.fecha || '').localeCompare(b.fecha || '')
    if (cmp !== 0) return cmp
    return (a.hora || '').localeCompare(b.hora || '')
  })

  // Agrupar por día
  ordenados.forEach((evento) => {
    if (!agrupados.has(evento.fecha)) {
      agrupados.set(evento.fecha, [])
    }
    agrupados.get(evento.fecha).push(evento)
  })

  // Convertir a array de objetos, en orden cronológico de claves
  return Array.from(agrupados.entries())
    .map(([dia, eventos]) => ({ dia, eventos }))
}

// Obtiene eventos de un día específico, filtrados y ordenados por hora.
export function eventosDelDia(eventos, dia, categoriasActivas = []) {
  let resultado = eventos.filter((e) => e.fecha === dia)

  if (categoriasActivas.length > 0) {
    resultado = resultado.filter((e) => categoriasActivas.includes(e.categoria))
  }

  return resultado.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
}

// Agrupa eventos por tramo horario: Mañana (00:00-12:00), Tarde (12:00-20:00),
// Noche (20:00-24:00), Madrugada (sin hora definida + eventos sin hora específica).
export function agruparPorTramoHorario(eventos) {
  const tramos = {
    mañana: [],
    tarde: [],
    noche: [],
    madrugada: [],
  }

  eventos.forEach((evento) => {
    if (!evento.hora) {
      tramos.madrugada.push(evento)
      return
    }

    const [horas] = evento.hora.split(':')
    const h = parseInt(horas, 10)

    if (h < 12) {
      tramos.mañana.push(evento)
    } else if (h < 20) {
      tramos.tarde.push(evento)
    } else {
      tramos.noche.push(evento)
    }
  })

  // Ordenar dentro de cada tramo por hora
  Object.keys(tramos).forEach((tramo) => {
    if (tramo !== 'madrugada') {
      tramos[tramo].sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
    }
  })

  return tramos
}

// Subtipos de imagen "culturales": describen la FORMA del acto (una obra de
// teatro, un DJ, una orquesta) y le pegan la misma foto tanto si el acto se
// programa dentro de cultura como dentro de fiestas — la verbena con DJ es de
// fiestas, pero la foto que la ilustra es la de un DJ. Por eso se guardan
// SIEMPRE bajo la categoría 'cultura' a efectos de imagen (ver
// destinoImagenEvento): así se suben una sola vez y sirven a las dos.
export const SUBTIPOS_CULTURALES = [
  'teatro',
  'concierto',
  'dj',
  'orquesta',
  'discoteca',
  'danza',
  'musica-callejera',
  'cine',
  'exposicion',
]

// Infiere el subtipo ("disciplina") de un evento para afinar la imagen
// ilustrativa: en deporte, la disciplina (tenis, fútbol…); en cultura, la
// forma del acto (teatro, dj, orquesta…); en fiestas, `religiosa` para los
// actos de registro religioso (novenas, misas, procesiones), que no deben
// salir con una foto de fuegos o de encierro — el programa 2026 trae 14 —, y
// si no, el mismo vocabulario cultural (una verbena con orquesta).
// Devuelve el subtipo (string) o null si no se reconoce. El vocabulario debe
// coincidir con DISCIPLINAS_POR_CATEGORIA del panel de imágenes genéricas
// (PanelImagenesGenericas.jsx).
// Orden: frases y términos específicos primero (ej. "tenis de mesa" antes que
// "tenis", "dj" antes que "musical") para evitar falsos positivos.
export function disciplinaDeEvento(evento) {
  if (!evento.titulo && !evento.subcategoria) return null

  const t = normalizarTexto(evento.titulo || '')

  if (evento.categoria === 'fiestas') {
    // Subcategoría del programa primero; palabras clave de los títulos reales
    // como respaldo (fuentes que no la traen, p. ej. Instagram). `\bpatrona\b`
    // con frontera para NO cazar "patronales" (un torneo de fiestas
    // patronales no es una misa).
    if (evento.subcategoria === 'religiosa') return 'religiosa'
    if (/(novena|\bmisa\b|procesion|ofrenda|rosario|eucaristia|\bsalve\b|\bpatrona\b|visperas|romeria)/.test(t)) {
      return 'religiosa'
    }
    // Un acto de fiestas que además es cultural (verbena con orquesta, teatro
    // en la plaza) usa el vocabulario cultural; el resto (pregón, encierro,
    // fuegos) se queda en las generales de fiestas.
    return subtipoCulturalEn(t)
  }

  if (evento.categoria === 'cultura') {
    // La subcategoría que ya traen TYL TYL, Red de Teatros e Instagram manda
    // cuando es concreta; 'musica' es demasiado gruesa para elegir foto (no es
    // lo mismo un DJ que una orquesta), así que se afina por título y solo si
    // el título no dice nada se cae a 'concierto'.
    const sub = evento.subcategoria
    if (sub === 'teatro' || sub === 'cine' || sub === 'danza' || sub === 'exposicion') return sub
    if (sub === 'musica') return subtipoCulturalEn(t) ?? 'concierto'
    return subtipoCulturalEn(t)
  }

  if (evento.categoria !== 'deporte') return null

  // Título primero; si no dice nada, la descripción (un "Memorial Ángel
  // Carrizo" no nombra el deporte, pero su descripción dice "Equipos: CDA
  // Navalcarnero – Real Madrid CF"). Solo dentro de deporte: en otras
  // categorías la descripción daría falsos positivos.
  return (
    disciplinaDeportivaEn(t) ??
    disciplinaDeportivaEn(normalizarTexto(evento.descripcion || '')) ??
    null
  )
}

/**
 * Dónde vive la imagen ilustrativa de un evento: la categoría bajo la que
 * buscarla (o subirla) y el subtipo, null si no se reconoce ninguno. Los
 * subtipos culturales se resuelven siempre contra 'cultura' aunque el evento
 * sea de fiestas — ver SUBTIPOS_CULTURALES.
 */
export function destinoImagenEvento(evento) {
  const subtipo = evento ? disciplinaDeEvento(evento) : null
  if (subtipo && SUBTIPOS_CULTURALES.includes(subtipo)) {
    return { categoria: 'cultura', subtipo }
  }
  return { categoria: evento?.categoria ?? null, subtipo: subtipo ?? null }
}

// Subtipo cultural en un texto ya normalizado (minúsculas, sin acentos), o
// null. Lo específico antes que lo genérico: "animación musical a cargo de DJ
// Piwi" es 'dj', no 'concierto'.
function subtipoCulturalEn(t) {
  if (!t) return null
  if (/(charanga|pasacalles|batucada|dulzain|fanfarria|tamborrada)/.test(t)) return 'musica-callejera'
  if (/(\bdj\b|\bdjs\b|disc\s*jockey)/.test(t)) return 'dj'
  if (/(discoteca|disco\s*movil|discomovil)/.test(t)) return 'discoteca'
  if (/orquesta/.test(t)) return 'orquesta'
  if (/(danza|ballet|flamenco|\bbaile\b|\bbailes\b)/.test(t)) return 'danza'
  if (/(teatro|comedia|monologo|titeres|marionetas|zarzuela)/.test(t)) return 'teatro'
  if (/(\bcine\b|pelicula|proyeccion|cortometraje)/.test(t)) return 'cine'
  if (/(exposicion|pinacoteca)/.test(t)) return 'exposicion'
  if (/(concierto|recital|tributo|musical|\bcoro\b|\bbanda\b|sinfonic|cantautor)/.test(t)) {
    return 'concierto'
  }
  return null
}

function normalizarTexto(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Disciplina deportiva en un texto ya normalizado (minúsculas, sin acentos),
// o null. Frases antes que palabras simples (contención).
function disciplinaDeportivaEn(t) {
  if (!t) return null
  if (/tenis\s+de\s+mesa/.test(t)) return 'tenis-de-mesa'
  if (/tiro\s+al\s+plato/.test(t)) return 'tiro-al-plato'

  if (/\btenis\b/.test(t)) return 'tenis'
  // "CF"/"FC" (Real Madrid CF) y las siglas de fútbol sala que usan los clubes
  // locales: "futsal", "futsi", "FS Navalcarnero".
  if (/(futbol|futsal|futsi|\bcf\b|\bfc\b|\bfs\b)/.test(t)) return 'futbol'
  if (/padel/.test(t)) return 'padel'
  if (/(baloncesto|basketball|basket)/.test(t)) return 'baloncesto'
  if (/petanca/.test(t)) return 'petanca'
  if (/ajedrez/.test(t)) return 'ajedrez'
  // "aquatlón" con q es la grafía de la galería de Deportes ("Aquatlón 2 sept").
  if (/(natacion|piscina|acuatlon|aquatlon|aquathlon|waterpolo|aquazumba)/.test(t)) return 'natacion'
  if (/(atletismo|carrera\s+popular|milla\s+atletica|\bcross\b|velocidad)/.test(t)) return 'atletismo'
  return null
}
