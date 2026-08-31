// Funciones para validar y formatear horarios de comercios.
//
// MODELO (columna jsonb `comercios_perfil.horarios`): un array de 7 días
//   [{dia, abierto, apertura, cierre, franjas: [{apertura, cierre}, …]}, …]
//
// `franjas` es la fuente de verdad (permite cierre a mediodía: mañana + tarde);
// `apertura`/`cierre` se siguen escribiendo como ESPEJO de la primera franja
// para que las filas guardadas antes de esta feature —y cualquier lector que
// solo conozca aquel formato— sigan siendo válidas en ambas direcciones. Por
// eso no hace falta migrar nada: `franjasDe()` deriva las franjas de
// apertura/cierre cuando la fila no las trae.

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

/** Máximo de franjas por día (mañana / tarde / noche). */
export const MAX_FRANJAS = 3

const ES_HORA = /^\d{2}:\d{2}$/

/** "09:30" → 570. NaN si la hora no tiene el formato esperado. */
export function minutosDe(hora) {
  if (!ES_HORA.test(hora || '')) return NaN
  const [h, m] = hora.split(':').map(Number)
  if (h > 23 || m > 59) return NaN
  return h * 60 + m
}

/**
 * Franjas de un día, normalizadas. Si la fila no trae `franjas` (formato
 * anterior a esta feature), se deriva la única franja de apertura/cierre.
 */
export function franjasDe(dia) {
  if (!dia || typeof dia !== 'object') return []
  if (Array.isArray(dia.franjas) && dia.franjas.length > 0) {
    return dia.franjas.map((f) => ({ apertura: f?.apertura || '', cierre: f?.cierre || '' }))
  }
  if (dia.apertura || dia.cierre) {
    return [{ apertura: dia.apertura || '', cierre: dia.cierre || '' }]
  }
  return []
}

/**
 * Deja un día con `franjas` explícitas y el espejo apertura/cierre al día.
 * Es lo que se guarda y lo que consume la UI.
 */
export function normalizarDia(dia) {
  const franjas = franjasDe(dia)
  const primera = franjas[0] || { apertura: '09:00', cierre: '14:00' }
  return {
    ...dia,
    franjas: franjas.length > 0 ? franjas : [primera],
    apertura: primera.apertura,
    cierre: primera.cierre,
  }
}

/** Normaliza el array de 7 días completo. */
export function normalizarHorarios(horarios) {
  if (!Array.isArray(horarios)) return horariosVacios()
  return horarios.map(normalizarDia)
}

/**
 * Valida un array de horarios (mismo criterio en cliente y en
 * api/admin/comercio-perfil.js): cada franja de un día abierto debe tener
 * horas bien formadas, cierre > apertura, y no solaparse ni desordenarse
 * respecto de la anterior.
 */
export function horarioValido(horarios) {
  if (!Array.isArray(horarios)) return false

  return horarios.every((h) => {
    if (typeof h !== 'object' || h === null) return false
    if (!DIAS_SEMANA.includes(h.dia)) return false
    if (typeof h.abierto !== 'boolean') return false
    if (!h.abierto) return true

    const franjas = franjasDe(h)
    if (franjas.length === 0 || franjas.length > MAX_FRANJAS) return false

    let finAnterior = -1
    for (const f of franjas) {
      const inicio = minutosDe(f.apertura)
      const fin = minutosDe(f.cierre)
      if (Number.isNaN(inicio) || Number.isNaN(fin)) return false
      if (fin <= inicio) return false
      if (inicio < finAnterior) return false // solapada o desordenada
      finAnterior = fin
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
    return `${dia}: ${formatearFranjas(h)}`
  })

  return lineas.join('\n')
}

/** "09:00–14:00 · 17:00–20:30" para un día. */
export function formatearFranjas(dia) {
  return franjasDe(dia)
    .map((f) => `${f.apertura}–${f.cierre}`)
    .join(' · ')
}

/** true si algún día tiene horario publicable (abierto con franjas válidas). */
export function tieneHorarioPublicado(horarios) {
  if (!Array.isArray(horarios)) return false
  return horarios.some((h) => h?.abierto && franjasDe(h).length > 0)
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
    franjas: [{ apertura: '09:00', cierre: '14:00' }],
  }))
}

/**
 * Retorna los días mostrados en un formato UI-friendly.
 */
export const diasSemana = () => DIAS_SEMANA
export const diasDisplay = () => DIAS_DISPLAY
