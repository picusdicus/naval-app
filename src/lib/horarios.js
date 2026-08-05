// Funciones para validar y formatear horarios de comercios.

const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const DIAS_DISPLAY = {
  lunes: 'Lunes',
  martes: 'Martes',
  miércoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sábado: 'Sábado',
  domingo: 'Domingo',
}

/**
 * Valida un array de horarios.
 * Formato: [{dia: "lunes", abierto: true, apertura: "09:00", cierre: "14:00"}, ...]
 */
export function horarioValido(horarios) {
  if (!Array.isArray(horarios)) return false

  return horarios.every((h) => {
    if (typeof h !== 'object' || h === null) return false
    if (!DIAS_SEMANA.includes(h.dia)) return false
    if (typeof h.abierto !== 'boolean') return false

    if (h.abierto) {
      if (!/^\d{2}:\d{2}$/.test(h.apertura) || !/^\d{2}:\d{2}$/.test(h.cierre)) {
        return false
      }
      // Validar que cierre > apertura
      const [aH, aM] = h.apertura.split(':').map(Number)
      const [cH, cM] = h.cierre.split(':').map(Number)
      if (cH * 60 + cM <= aH * 60 + aM) return false
    }

    return true
  })
}

/**
 * Formatea horarios para mostrar en la UI.
 * Retorna un string legible o vacío si no hay horarios.
 */
export function formatearHorarios(horarios) {
  if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
    return ''
  }

  const lineas = horarios.map((h) => {
    const dia = DIAS_DISPLAY[h.dia] || h.dia
    if (!h.abierto) {
      return `${dia}: Cerrado`
    }
    return `${dia}: ${h.apertura}–${h.cierre}`
  })

  return lineas.join('\n')
}

/**
 * Genera un array de horarios vacío (7 días, todos cerrados).
 */
export function horariosVacios() {
  return DIAS_SEMANA.map((dia) => ({
    dia,
    abierto: false,
    apertura: '09:00',
    cierre: '14:00',
  }))
}

/**
 * Retorna los días mostrados en un formato UI-friendly.
 */
export const diasSemana = () => DIAS_SEMANA
export const diasDisplay = () => DIAS_DISPLAY
