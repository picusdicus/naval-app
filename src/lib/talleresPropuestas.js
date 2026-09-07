// Reimportar el folleto de talleres no debe duplicar el catálogo (fase 3).
// Este módulo decide si un taller extraído de un PDF YA existe, qué cambiaría
// respecto al que hay guardado, y cómo queda el taller si se acepta el cambio.
//
// Módulo "limpio" (sin JSX/JSON/SQL) a propósito: lo importan el navegador (el
// tab Talleres pinta el diff), un handler Node (la importación) y uno Edge (el
// endpoint de propuestas).

import { claveTitulo, palabrasSignificativas } from './dedupEventos.js'
import { textoTurno } from './talleres.js'

/**
 * Clave de emparejamiento de un nombre de taller: sus palabras significativas
 * normalizadas, en orden.
 *
 * Reutiliza las primitivas del matcher canónico de eventos (minúsculas, sin
 * acentos ni puntuación, ignorando artículos y preposiciones) pero NO
 * titulosEquivalentes(): su regla de contención ≥12 caracteres está pensada
 * para eventos que se redactan con palabras de más, y aquí sería un pasivo —
 * el catálogo distingue hermanos POR SUFIJO a propósito ("Pintura adultos
 * iniciación" / "Pintura adultos avanzado" / "Pintura infantil"). Un folleto
 * que escribiera "Pintura adultos" quedaría contenido en dos de ellos y
 * emparejaría con el primero que pillara, en silencio.
 *
 * Igualdad exacta, pues: absorbe acentos, mayúsculas y un artículo perdido
 * ("Relajación y cuidado de espalda") y no fusiona nada más.
 */
export function claveNombreTaller(nombre) {
  return palabrasSignificativas(claveTitulo(nombre)).join(' ')
}

/** Curso normalizado para comparar ("2026/2027" y " 2026/2027 " son el mismo). */
const claveCurso = (curso) => String(curso ?? '').trim().toLowerCase()

/**
 * El taller ya existente que corresponde al extraído, o null.
 *
 * El emparejamiento está ACOTADO AL MISMO CURSO a propósito: en junio se
 * importa el folleto del curso SIGUIENTE con el actual todavía en marcha, y sin
 * acotar, ese import propondría sobrescribir el catálogo vivo con los datos del
 * año que viene. Acotado sale lo correcto: talleres nuevos en borrador para el
 * curso nuevo, y los del curso en marcha intactos hasta que los archive el
 * corte del 31 de julio.
 *
 * Cualquier estado cuenta como "ya existe" (un borrador de una importación
 * anterior sin revisar también es una fila del catálogo).
 */
export function emparejarTaller(extraido, existentes, curso) {
  const clave = claveNombreTaller(extraido?.nombre)
  if (!clave) return null
  const delCurso = claveCurso(curso)
  return (
    (existentes || []).find(
      (t) => claveCurso(t.curso) === delCurso && claveNombreTaller(t.nombre) === clave
    ) || null
  )
}

/**
 * Campos que el folleto sabe rellenar, en el orden en que se pintan.
 *
 * `descripcion` e `imagen` NO están aquí y es lo que evita el peor fallo
 * posible de esta feature: el parser no los extrae nunca (los deja a ''), así
 * que aceptar una propuesta como un PUT del payload extraído borraría la
 * descripción y el cartel de todos los talleres del catálogo.
 */
export const CAMPOS_DEL_FOLLETO = [
  ['nombre', 'Nombre'],
  ['categoria', 'Categoría'],
  ['lugar', 'Lugar'],
  ['precio', 'Precio'],
  ['edades', 'Edades'],
]

const texto = (v) => String(v ?? '').trim()

/**
 * Valor tal como se COMPARA (nunca como se guarda ni como se pinta): sin
 * mayúsculas y sin espacios.
 *
 * Existe por lo que se vio al reimportar el folleto real de 2026/2027: el
 * catálogo guardado venía transcrito a mano y el modelo transcribe el mismo
 * dato con otra redacción — "22 €/mes" vs "22€/mes" en LOS CATORCE talleres, y
 * "Nivel iniciación" vs "Nivel Iniciación" en las etiquetas de turno. Sin esta
 * normalización, reimportar un folleto que no ha cambiado nada propone catorce
 * actualizaciones que no dicen nada, y revisarlas una a una entrena a decir
 * que sí sin mirar — que es justo lo que esta bandeja tiene que evitar.
 *
 * Solo se ignoran mayúsculas y espacios: un cambio de importe ("22" → "25"),
 * de unidad ("/mes" → "/trimestre") o de palabra sigue saliendo. Y como el
 * valor guardado no se toca, la redacción del catálogo se mantiene.
 */
const paraComparar = (v) => texto(v).toLowerCase().replace(/\s+/g, '')

/**
 * Firma comparable de un turno: incluye el lugar, que textoTurno() no pinta.
 * Los días y las horas ya son estructurados; etiqueta y lugar se comparan con
 * la normalización de arriba.
 */
const firmaTurno = (t) =>
  [
    paraComparar(t?.etiqueta),
    (Array.isArray(t?.dias) ? t.dias : []).join(','),
    texto(t?.horaInicio),
    texto(t?.horaFin),
    paraComparar(t?.lugar),
  ].join('|')

/** ¿Este turno no dice absolutamente nada? */
const turnoVacio = (t) => firmaTurno(t) === '||||'

/** Turnos que aportan información (una lista de turnos todos vacíos no aporta). */
export const turnosConDatos = (turnos) =>
  (Array.isArray(turnos) ? turnos : []).some((t) => !turnoVacio(t))

/** ¿Las dos listas de turnos dicen lo mismo? */
export function mismosTurnos(a, b) {
  const firma = (l) => (Array.isArray(l) ? l : []).map(firmaTurno).join('¦')
  return firma(a) === firma(b)
}

/** Cómo se lee un turno en el diff: lo de textoTurno() más el lugar propio. */
export function textoTurnoCompleto(turno) {
  const base = textoTurno(turno)
  const lugar = texto(turno?.lugar)
  return lugar ? `${base} — ${lugar}` : base
}

/**
 * Qué cambiaría en `existente` si se aceptara `propuesto`, como lista de
 * {campo, etiqueta, antes, despues}. Vacía si no cambia nada.
 *
 * REGLA: un valor extraído VACÍO significa "el folleto no lo dice", no "está
 * vacío" — es literalmente lo que le pide el prompt al modelo ("cadena vacía si
 * no consta"). Por eso un campo vacío nunca cuenta como diferencia ni borra lo
 * guardado: una extracción incompleta no puede vaciar un dato bueno. Vaciar un
 * campo a propósito se hace a mano desde el formulario.
 *
 * El diff se calcula SIEMPRE contra el taller vivo, nunca se guarda: si se
 * guardara, mostraría una foto del momento de importar y no el estado actual.
 */
export function diferenciasTaller(existente, propuesto) {
  const cambios = []

  for (const [campo, etiqueta] of CAMPOS_DEL_FOLLETO) {
    const despues = texto(propuesto?.[campo])
    const antes = texto(existente?.[campo])
    if (!despues || paraComparar(despues) === paraComparar(antes)) continue
    cambios.push({ campo, etiqueta, antes, despues })
  }

  // Los turnos se comparan (y se aplican) en bloque: no tienen identidad
  // estable —la etiqueta puede ir vacía y nada los referencia desde fuera—, así
  // que un diff turno a turno tendría que inventarse esa identidad para no
  // ganar nada. El humano ve la lista entera antes y después.
  if (turnosConDatos(propuesto?.turnos) && !mismosTurnos(existente?.turnos, propuesto?.turnos)) {
    cambios.push({
      campo: 'turnos',
      etiqueta: 'Turnos',
      lista: true,
      antes: (existente?.turnos || []).map(textoTurnoCompleto),
      despues: (propuesto?.turnos || []).map(textoTurnoCompleto),
    })
  }

  return cambios
}

/**
 * El taller tal como quedaría al aceptar: el guardado manda en todo lo que el
 * folleto no sabe (descripción, cartel, estado, curso — y el destacado, que
 * vive en otra tabla y ni se toca), y el folleto solo pisa sus campos.
 *
 * Devuelve un cuerpo listo para el PUT de /api/super/talleres.
 */
export function fusionarConPropuesta(existente, propuesto) {
  const fusionado = { ...existente }

  for (const [campo] of CAMPOS_DEL_FOLLETO) {
    const valor = texto(propuesto?.[campo])
    // Un campo que solo cambia de redacción (espacios o mayúsculas) no se
    // reescribe: no es un cambio, y así aceptar una propuesta toca exactamente
    // los campos que el diff enseñó.
    if (!valor || paraComparar(valor) === paraComparar(fusionado[campo])) continue
    fusionado[campo] = valor
  }

  if (turnosConDatos(propuesto?.turnos) && !mismosTurnos(existente?.turnos, propuesto?.turnos)) {
    fusionado.turnos = propuesto.turnos
  }

  return fusionado
}
