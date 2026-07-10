// Reglas de un evento creado desde /admin. Lo importan el formulario (para
// avisar antes de enviar) y `api/admin/eventos.js` (para no fiarse del cliente):
// una única definición de qué es un evento válido.

import { CATEGORIAS_EVENTO } from './eventos.js'

export const ESTADOS_EVENTO = ['borrador', 'publicado']

export const VALORES_INICIALES = {
  titulo: '',
  descripcion: '',
  categoria: '',
  lugar: '',
  fecha: '',
  hora: '',
  horaFin: '',
  imagen: '',
  entradasTexto: '',
  entradasUrl: '',
  precio: '',
  estado: 'borrador',
}

export const LIMITES = {
  titulo: 120,
  descripcion: 2000,
  lugar: 120,
  entradasTexto: 40,
  precio: 40,
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/
const HORA_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const texto = (valor) => String(valor ?? '').trim()

/** Solo http(s): evita `javascript:` y otros esquemas peligrosos en el enlace. */
export function urlValida(valor) {
  try {
    const { protocol } = new URL(texto(valor))
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Devuelve un objeto { campo: mensaje } con los errores encontrados. Vacío
 * significa que el evento es válido.
 */
export function validarEvento(valores) {
  const errores = {}
  const v = (campo) => texto(valores[campo])

  if (!v('titulo')) errores.titulo = 'El título es obligatorio.'
  else if (v('titulo').length > LIMITES.titulo)
    errores.titulo = `Máximo ${LIMITES.titulo} caracteres.`

  if (!v('descripcion')) errores.descripcion = 'Añade una descripción del evento.'
  else if (v('descripcion').length > LIMITES.descripcion)
    errores.descripcion = `Máximo ${LIMITES.descripcion} caracteres.`

  if (!v('categoria')) errores.categoria = 'Elige una categoría.'
  else if (!CATEGORIAS_EVENTO[v('categoria')]) errores.categoria = 'Categoría desconocida.'

  if (!v('lugar')) errores.lugar = 'Indica dónde se celebra.'
  else if (v('lugar').length > LIMITES.lugar) errores.lugar = `Máximo ${LIMITES.lugar} caracteres.`

  if (!v('fecha')) errores.fecha = 'La fecha es obligatoria.'
  else if (!FECHA_ISO.test(v('fecha'))) errores.fecha = 'Formato de fecha no válido.'

  if (!v('hora')) errores.hora = 'Indica la hora de inicio.'
  else if (!HORA_HHMM.test(v('hora'))) errores.hora = 'Usa el formato HH:MM.'

  // La hora de fin es opcional, pero si se indica debe ser posterior al inicio.
  if (v('horaFin')) {
    if (!HORA_HHMM.test(v('horaFin'))) errores.horaFin = 'Usa el formato HH:MM.'
    else if (HORA_HHMM.test(v('hora')) && v('horaFin') <= v('hora'))
      errores.horaFin = 'Debe ser posterior a la hora de inicio.'
  }

  // El botón de entradas es opcional y va en bloque: si se empieza a rellenar,
  // hacen falta al menos el texto del botón y el enlace.
  const hayEntradas = Boolean(v('entradasTexto') || v('entradasUrl') || v('precio'))
  if (hayEntradas) {
    if (!v('entradasTexto')) errores.entradasTexto = 'Escribe el texto del botón.'
    else if (v('entradasTexto').length > LIMITES.entradasTexto)
      errores.entradasTexto = `Máximo ${LIMITES.entradasTexto} caracteres.`

    if (!v('entradasUrl')) errores.entradasUrl = 'Añade el enlace de compra.'
    else if (!urlValida(v('entradasUrl'))) errores.entradasUrl = 'Debe empezar por http:// o https://'

    if (v('precio').length > LIMITES.precio) errores.precio = `Máximo ${LIMITES.precio} caracteres.`
  }

  if (!ESTADOS_EVENTO.includes(valores.estado)) errores.estado = 'Estado no válido.'

  if (v('imagen') && !urlValida(v('imagen'))) errores.imagen = 'La imagen no se subió bien.'

  return errores
}

export const esValido = (valores) => Object.keys(validarEvento(valores)).length === 0

/** Recorta y normaliza los campos antes de guardarlos. */
export function normalizarEvento(valores) {
  const v = (campo) => texto(valores[campo])
  const hayEntradas = Boolean(v('entradasTexto') && v('entradasUrl'))

  return {
    titulo: v('titulo'),
    descripcion: v('descripcion'),
    categoria: v('categoria'),
    lugar: v('lugar'),
    fecha: v('fecha'),
    hora: v('hora'),
    horaFin: v('horaFin') || null,
    imagen: v('imagen') || null,
    entradasTexto: hayEntradas ? v('entradasTexto') : null,
    entradasUrl: hayEntradas ? v('entradasUrl') : null,
    precio: hayEntradas ? v('precio') || null : null,
    estado: valores.estado,
  }
}
