// Definición única de qué es un taller válido, al modo de eventoForm.js: el
// formulario del panel la importa para avisar antes de enviar y el endpoint
// api/super/talleres.js la vuelve a ejecutar en servidor — el cliente nunca se
// cree. Módulo "limpio" (sin JSX/JSON): lo importa un handler Edge.

import { IDS_CATEGORIAS_TALLER, IDS_DIAS } from './talleres.js'

export const LIMITES = {
  nombre: 140,
  descripcion: 2000,
  lugar: 160,
  precio: 60,
  edades: 80,
  curso: 20,
  etiquetaTurno: 80,
}

export const MAX_TURNOS = 12

export const ESTADOS_TALLER = ['borrador', 'publicado', 'archivado']

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

export const TURNO_VACIO = { etiqueta: '', dias: [], horaInicio: '', horaFin: '', lugar: '' }

export const VALORES_INICIALES = {
  nombre: '',
  categoria: '',
  descripcion: '',
  lugar: '',
  precio: '',
  edades: '',
  imagen: '',
  curso: '',
  estado: 'publicado',
  turnos: [{ ...TURNO_VACIO }],
}

const texto = (v) => String(v ?? '').trim()

/**
 * Errores de un taller, como mapa campo → mensaje (vacío si es válido). Los
 * errores de turno se devuelven con clave `turno-<i>` para que el formulario
 * pueda marcar la fila concreta del repetidor.
 *
 * Un turno SIN NINGÚN dato es válido a propósito: "Historia del arte y
 * literatura" está en el catálogo con horario por determinar, y obligar a
 * inventarse uno sería peor que mostrarlo como "Por determinar".
 */
export function validarTaller(taller) {
  const errores = {}

  const nombre = texto(taller.nombre)
  if (!nombre) errores.nombre = 'El nombre es obligatorio.'
  else if (nombre.length > LIMITES.nombre) {
    errores.nombre = `El nombre no puede superar ${LIMITES.nombre} caracteres.`
  }

  const categoria = texto(taller.categoria)
  if (!categoria) errores.categoria = 'Elige una categoría.'
  else if (!IDS_CATEGORIAS_TALLER.includes(categoria)) {
    errores.categoria = 'Esa categoría no está en el catálogo.'
  }

  for (const campo of ['descripcion', 'lugar', 'precio', 'edades', 'curso']) {
    if (texto(taller[campo]).length > LIMITES[campo]) {
      errores[campo] = `No puede superar ${LIMITES[campo]} caracteres.`
    }
  }

  const estado = texto(taller.estado) || 'borrador'
  if (!ESTADOS_TALLER.includes(estado)) errores.estado = 'Estado no válido.'

  const turnos = Array.isArray(taller.turnos) ? taller.turnos : []
  if (turnos.length > MAX_TURNOS) {
    errores.turnos = `Un taller no puede tener más de ${MAX_TURNOS} turnos.`
  }

  turnos.forEach((turno, i) => {
    const clave = `turno-${i}`
    const dias = Array.isArray(turno?.dias) ? turno.dias : []
    const inicio = texto(turno?.horaInicio)
    const fin = texto(turno?.horaFin)

    if (dias.some((d) => !IDS_DIAS.includes(d))) {
      errores[clave] = 'Día de la semana no válido.'
      return
    }
    if (texto(turno?.etiqueta).length > LIMITES.etiquetaTurno) {
      errores[clave] = `La etiqueta no puede superar ${LIMITES.etiquetaTurno} caracteres.`
      return
    }
    if (texto(turno?.lugar).length > LIMITES.lugar) {
      errores[clave] = `El lugar no puede superar ${LIMITES.lugar} caracteres.`
      return
    }
    if (inicio && !HORA.test(inicio)) {
      errores[clave] = 'La hora de inicio debe tener el formato HH:MM.'
      return
    }
    if (fin && !HORA.test(fin)) {
      errores[clave] = 'La hora de fin debe tener el formato HH:MM.'
      return
    }
    if (fin && !inicio) {
      errores[clave] = 'Indica también la hora de inicio.'
      return
    }
    if (inicio && fin && fin <= inicio) {
      errores[clave] = 'La hora de fin debe ser posterior a la de inicio.'
      return
    }
    // Un turno con horas pero sin día no se puede mostrar ("· 17:30-19:30"):
    // o se concreta el día, o se deja el turno entero por determinar.
    if (inicio && dias.length === 0) {
      errores[clave] = 'Elige al menos un día para este turno.'
    }
  })

  return errores
}

/** Taller saneado y listo para guardar: cadenas recortadas, turnos ordenados. */
export function normalizarTaller(taller) {
  const turnos = (Array.isArray(taller.turnos) ? taller.turnos : []).map((t, i) => ({
    etiqueta: texto(t?.etiqueta),
    // Se reordenan al orden semanal para que ['jueves','martes'] y
    // ['martes','jueves'] queden idénticos en la base — la fase 3 comparará
    // turnos y dos arrays con el mismo contenido en distinto orden no deben
    // parecer turnos distintos.
    dias: IDS_DIAS.filter((d) => (Array.isArray(t?.dias) ? t.dias : []).includes(d)),
    horaInicio: texto(t?.horaInicio),
    horaFin: texto(t?.horaFin),
    lugar: texto(t?.lugar),
    orden: i,
  }))

  return {
    nombre: texto(taller.nombre),
    categoria: texto(taller.categoria),
    descripcion: texto(taller.descripcion),
    lugar: texto(taller.lugar),
    precio: texto(taller.precio),
    edades: texto(taller.edades),
    imagen: texto(taller.imagen),
    curso: texto(taller.curso),
    estado: ESTADOS_TALLER.includes(texto(taller.estado)) ? texto(taller.estado) : 'borrador',
    turnos,
  }
}
