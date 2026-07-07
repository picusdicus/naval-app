// Utilidades para calcular próximas salidas a partir de los horarios oficiales
// del CRTM (src/data/horarios-bus.json). Compartidas por la sección Transporte
// y por el asistente (api/_knowledge.js), por lo que debe ser JS puro.

export function tipoDeDia(fecha = new Date()) {
  const dia = fecha.getDay()
  if (dia === 0) return 'festivo'
  if (dia === 6) return 'sabado'
  return 'laborable'
}

export const ETIQUETA_TIPO_DIA = {
  laborable: 'laborable',
  sabado: 'sábado',
  festivo: 'domingo y festivos',
}

export function aMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Próximas `n` salidas de hoy para un sentido, con minutos restantes.
export function proximasSalidas(horarios, fecha = new Date(), n = 3) {
  const tipo = tipoDeDia(fecha)
  const ahora = fecha.getHours() * 60 + fecha.getMinutes()
  return (horarios[tipo] || [])
    .filter((h) => aMinutos(h) >= ahora)
    .slice(0, n)
    .map((h) => ({ hora: h, enMin: aMinutos(h) - ahora }))
}

// Primera salida del día siguiente (según su tipo de día).
export function primeraSalidaManana(horarios, fecha = new Date()) {
  const manana = new Date(fecha)
  manana.setDate(manana.getDate() + 1)
  const tipo = tipoDeDia(manana)
  return (horarios[tipo] || [])[0] || null
}

// Primera y última salida de hoy (para resúmenes).
export function rangoDeHoy(horarios, fecha = new Date()) {
  const tipo = tipoDeDia(fecha)
  const lista = horarios[tipo] || []
  if (!lista.length) return null
  return { primera: lista[0], ultima: lista[lista.length - 1] }
}
