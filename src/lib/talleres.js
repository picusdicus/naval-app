// Vocabulario de los talleres municipales (catálogo del curso).
//
// Módulo "limpio" (sin JSX/JSON), como tarifasDestacados.js y temasPush.js: lo
// importan handlers Edge, el panel de superadmin y las páginas públicas.
//
// Qué es una "categoría" aquí: la DISCIPLINA del taller (pintura, yoga…), no
// una categoría de evento. Es deliberado y es lo que permite reutilizar tal
// cual el mecanismo de imágenes genéricas de la issue #23 sin tocar su tabla:
// una imagen de taller se sube con `categoria = 'talleres'` (que sí existe en
// CATEGORIAS_EVENTO) y `disciplina = <esta categoría>`. Ver destinoDeTaller().
//
// El catálogo cambia cada curso, así que NO hay CHECK en la tabla `talleres`:
// una disciplina nueva se añade aquí y ya está. Una categoría desconocida en
// una fila antigua degrada a etiqueta cruda + color por defecto, nunca rompe.

// Familias del catálogo impreso. Solo ordenan los chips de filtro y agrupan el
// listado: no son un segundo eje de filtrado (eso sería otra decisión).
export const FAMILIAS_TALLER = {
  artisticas: { id: 'artisticas', nombre: 'Técnicas artísticas' },
  bienestar: { id: 'bienestar', nombre: 'Bienestar y cuidado del cuerpo' },
  danza: { id: 'danza', nombre: 'Danza y movimiento' },
}

export const LISTA_FAMILIAS_TALLER = Object.values(FAMILIAS_TALLER)

// Los colores siguen la paleta apagada de La Gaceta (mismo registro que los de
// CATEGORIAS_EVENTO): sirven para el punto del chip de filtro y para el
// degradado de la tarjeta sin imagen.
export const CATEGORIAS_TALLER = {
  pintura: { id: 'pintura', nombre: 'Pintura', familia: 'artisticas', color: '#8A4327' },
  'talla-madera': { id: 'talla-madera', nombre: 'Talla en madera', familia: 'artisticas', color: '#8A6D3A' },
  restauracion: { id: 'restauracion', nombre: 'Restauración', familia: 'artisticas', color: '#B5822B' },
  'historia-arte': { id: 'historia-arte', nombre: 'Historia del arte', familia: 'artisticas', color: '#6E5B8C' },
  teatro: { id: 'teatro', nombre: 'Teatro', familia: 'artisticas', color: '#7A2E3E' },
  bienestar: { id: 'bienestar', nombre: 'Relajación', familia: 'bienestar', color: '#2F6F6B' },
  yoga: { id: 'yoga', nombre: 'Yoga', familia: 'bienestar', color: '#3B7A57' },
  pilates: { id: 'pilates', nombre: 'Pilates', familia: 'bienestar', color: '#5C6B4A' },
  batucada: { id: 'batucada', nombre: 'Batucada', familia: 'danza', color: '#C1633D' },
  'danza-oriental': { id: 'danza-oriental', nombre: 'Danza oriental', familia: 'danza', color: '#B5559A' },
  'bailes-latinos': { id: 'bailes-latinos', nombre: 'Bailes latinos', familia: 'danza', color: '#9B5A7A' },
  'bailes-salon': { id: 'bailes-salon', nombre: 'Bailes de salón', familia: 'danza', color: '#3E5F8A' },
}

// Ordenada por familia (y dentro de ella, por el orden de declaración): así los
// chips de filtro salen agrupados como en el folleto municipal.
export const LISTA_CATEGORIAS_TALLER = LISTA_FAMILIAS_TALLER.flatMap((f) =>
  Object.values(CATEGORIAS_TALLER).filter((c) => c.familia === f.id),
)

export const IDS_CATEGORIAS_TALLER = LISTA_CATEGORIAS_TALLER.map((c) => c.id)

/** Nombre legible de una categoría; la cruda si no está en el catálogo. */
export function nombreCategoriaTaller(id) {
  return CATEGORIAS_TALLER[id]?.nombre || id || 'Taller'
}

/** Color de una categoría; el terracota de la casa si no está en el catálogo. */
export function colorCategoriaTaller(id) {
  return CATEGORIAS_TALLER[id]?.color || '#b0472f'
}

export const DIAS_SEMANA = [
  { id: 'lunes', nombre: 'Lunes', corto: 'L' },
  { id: 'martes', nombre: 'Martes', corto: 'M' },
  { id: 'miercoles', nombre: 'Miércoles', corto: 'X' },
  { id: 'jueves', nombre: 'Jueves', corto: 'J' },
  { id: 'viernes', nombre: 'Viernes', corto: 'V' },
  { id: 'sabado', nombre: 'Sábado', corto: 'S' },
  { id: 'domingo', nombre: 'Domingo', corto: 'D' },
]

export const IDS_DIAS = DIAS_SEMANA.map((d) => d.id)

const NOMBRE_DIA = Object.fromEntries(DIAS_SEMANA.map((d) => [d.id, d.nombre]))

/**
 * Texto de los días de un turno: "Martes y jueves", "Lunes", "Lunes, miércoles
 * y viernes". Respeta el orden semanal aunque lleguen desordenados.
 */
export function textoDias(dias = []) {
  const ordenados = IDS_DIAS.filter((d) => dias.includes(d)).map((d) => NOMBRE_DIA[d])
  if (ordenados.length === 0) return ''
  if (ordenados.length === 1) return ordenados[0]
  const ultimo = ordenados[ordenados.length - 1].toLowerCase()
  return `${ordenados.slice(0, -1).join(', ')} y ${ultimo}`
}

/**
 * Texto completo de un turno: "Martes y jueves · 10:00-11:00", precedido de su
 * etiqueta si la tiene ("Adultos · Jueves · 20:00-22:00"). Un turno todavía sin
 * concretar (Historia del arte) se queda en "Por determinar".
 */
export function textoTurno(turno) {
  const partes = []
  if (turno?.etiqueta) partes.push(turno.etiqueta)
  const dias = textoDias(turno?.dias || [])
  if (dias) partes.push(dias)
  if (turno?.horaInicio) {
    partes.push(turno.horaFin ? `${turno.horaInicio}-${turno.horaFin}` : turno.horaInicio)
  }
  return partes.length > 0 ? partes.join(' · ') : 'Por determinar'
}

/**
 * Destino de la imagen ilustrativa de un taller, en el vocabulario que entiende
 * el mecanismo de la issue #23: SIEMPRE la categoría de evento 'talleres', con
 * la disciplina del taller como subtipo. Que ambas caigan bajo 'talleres'
 * significa que una foto subida "para talleres, sin disciplina" sirve a todo el
 * catálogo hasta que se suban fotos por disciplina.
 */
export function destinoDeTaller(taller) {
  return { categoria: 'talleres', subtipo: taller?.categoria || null }
}

/**
 * Adapta un taller a la forma mínima que esperan imagenEvento() /
 * genericasParaEvento() / useImagenEvento: id, titulo, imagen y el par
 * categoria+subcategoria del que sale su destino de imagen.
 *
 * Existe para NO duplicar la lógica de #23: todo lo que sabe de elegir una
 * ilustrativa sigue viviendo en imagenesEvento.js.
 */
export function tallerComoEvento(taller) {
  if (!taller) return null
  return {
    id: taller.id,
    titulo: taller.nombre,
    imagen: taller.imagen || '',
    categoria: 'talleres',
    subcategoria: taller.categoria || null,
  }
}
