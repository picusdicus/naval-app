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

// Infiere la disciplina de un evento de deporte por palabra clave del título.
// Devuelve la disciplina (string) o null si no se reconoce.
// Orden: frases primero (ej. "tenis de mesa" antes que "tenis") para evitar
// falsos positivos por contención.
export function disciplinaDeEvento(evento) {
  if (evento.categoria !== 'deporte') return null
  if (!evento.titulo) return null

  const t = evento.titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

  // Frases (antes que palabras simples, para contención exacta)
  if (/tenis\s+de\s+mesa/.test(t)) return 'tenis-de-mesa'
  if (/tiro\s+al\s+plato/.test(t)) return 'tiro-al-plato'

  // Palabras simples
  if (/\btenis\b/.test(t)) return 'tenis'
  if (/(futbol|futbol)/.test(t)) return 'futbol'
  if (/padel/.test(t)) return 'padel'
  if (/(baloncesto|basketball)/.test(t)) return 'baloncesto'
  if (/petanca/.test(t)) return 'petanca'
  if (/ajedrez/.test(t)) return 'ajedrez'
  if (/(natacion|natación|piscina|acuatlon|acuatlón)/.test(t)) return 'natacion'
  if (/(atletismo|carrera\s+popular|milla\s+atletica|milla\s+atletica|velocidad)/.test(t))
    return 'atletismo'

  return null
}
