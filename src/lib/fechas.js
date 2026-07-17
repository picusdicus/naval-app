// Aritmética de fechas sobre cadenas ISO `YYYY-MM-DD` en zona horaria LOCAL.
// Nunca `new Date('YYYY-MM-DD')` a secas: eso parsea en UTC y en España la
// medianoche UTC cae en el día anterior — el mismo motivo por el que la API
// formatea las columnas date con to_char en SQL.

/** 'YYYY-MM-DD' → Date a medianoche local. */
export function aFecha(iso) {
  return new Date(`${iso}T00:00:00`)
}

/** Date → 'YYYY-MM-DD' en zona local. */
export function aISO(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

/** La fecha de hoy como 'YYYY-MM-DD' local. */
export function hoyISO() {
  return aISO(new Date())
}

/** Suma n días naturales a una fecha ISO y devuelve otra ISO. */
export function sumarDias(iso, n) {
  const fecha = aFecha(iso)
  fecha.setDate(fecha.getDate() + n)
  return aISO(fecha)
}

/** Días naturales desde hoy hasta la fecha ISO: 0 = hoy, negativo = pasada. */
export function diasHasta(iso) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  // Math.round absorbe la hora extra/faltante de los cambios horario verano/invierno.
  return Math.round((aFecha(iso) - hoy) / 86_400_000)
}

/** Días naturales de una campaña con ambas fechas incluidas (7 días ⇒ fin = inicio + 6). */
export function duracionDe(inicioIso, finIso) {
  return Math.round((aFecha(finIso) - aFecha(inicioIso)) / 86_400_000) + 1
}

/** A cuántos días de fecha_fin se empieza a avisar de que un destacado caduca. */
export const UMBRAL_AVISO_CADUCIDAD = 5
