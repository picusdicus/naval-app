// Categorías de eventos + utilidades de fecha para la agenda vecinal.

export const CATEGORIAS_EVENTO = {
  fiestas: { id: 'fiestas', nombre: 'Fiestas', color: '#7A2E3E' },
  cultura: { id: 'cultura', nombre: 'Cultura', color: '#8A4327' },
  gastronomia: { id: 'gastronomia', nombre: 'Gastronomía', color: '#B5822B' },
  mercado: { id: 'mercado', nombre: 'Mercados', color: '#C1633D' },
  deporte: { id: 'deporte', nombre: 'Deporte', color: '#3B7A57' },
  infantil: { id: 'infantil', nombre: 'Infantil', color: '#B5559A' },
}

export const LISTA_CATEGORIAS_EVENTO = Object.values(CATEGORIAS_EVENTO)

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

// Eventos futuros (o de hoy) ordenados por fecha ascendente.
export function proximosEventos(eventos, limite) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const futuros = eventos
    .filter((e) => aFecha(e.fecha) >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''))
  return typeof limite === 'number' ? futuros.slice(0, limite) : futuros
}

// Eventos ya pasados, ordenados del más reciente al más antiguo (para el
// histórico de actividades culturales).
export function eventosPasados(eventos, limite) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const pasados = eventos
    .filter((e) => aFecha(e.fecha) < hoy)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora || '').localeCompare(a.hora || ''))
  return typeof limite === 'number' ? pasados.slice(0, limite) : pasados
}
