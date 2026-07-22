// Validación puntual de src/data/eventos.json tras el volcado del VIVE nº 25.
// Reutiliza los mismos regex y catálogo de categorías que usa la app, para no
// inventar una segunda definición de "evento válido".
import fs from 'node:fs'
import { CATEGORIAS_EVENTO } from '../src/lib/eventos.js'

// Mismos formatos que eventoForm.js (allí no se exportan). No se reutiliza
// `validarEvento` porque valida el contrato del formulario de administración,
// más estricto en dos puntos que aquí no aplican: exige `hora` no vacía y que
// `imagen` sea una URL http(s), y en el JSON estático hay eventos sin hora y
// carteles servidos desde /public.
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/
const HORA_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const eventos = JSON.parse(fs.readFileSync('src/data/eventos.json', 'utf8'))
const errores = []
const ids = new Set()

for (const e of eventos) {
  const donde = e.id || '(sin id)'
  if (!e.id) errores.push('Evento sin id')
  else if (ids.has(e.id)) errores.push(`${donde}: id duplicado`)
  else ids.add(e.id)

  if (!e.titulo) errores.push(`${donde}: sin titulo`)
  if (!e.lugar) errores.push(`${donde}: sin lugar`)
  if (!e.descripcion) errores.push(`${donde}: sin descripcion`)
  if (!FECHA_ISO.test(e.fecha || '')) errores.push(`${donde}: fecha inválida "${e.fecha}"`)
  if (e.hora !== '' && !HORA_HHMM.test(e.hora)) errores.push(`${donde}: hora inválida "${e.hora}"`)
  if (e.horaFin !== undefined) {
    if (!HORA_HHMM.test(e.horaFin)) errores.push(`${donde}: horaFin inválida "${e.horaFin}"`)
    else if (!(e.horaFin > e.hora)) errores.push(`${donde}: horaFin ${e.horaFin} no es posterior a ${e.hora}`)
  }
  if (!CATEGORIAS_EVENTO[e.categoria]) errores.push(`${donde}: categoría desconocida "${e.categoria}"`)
  if (!['municipal', 'vecinal'].includes(e.origen)) errores.push(`${donde}: origen desconocido "${e.origen}"`)
  if (e.imagen && !fs.existsSync(`public${e.imagen}`)) errores.push(`${donde}: falta la imagen ${e.imagen}`)
}

// Comprueba que no queden carteles extraídos sin usar.
const usadas = new Set(eventos.map((e) => e.imagen).filter(Boolean))
const enDisco = fs
  .readdirSync('public/img/eventos/vive25')
  .map((f) => `/img/eventos/vive25/${f}`)
const huerfanas = enDisco.filter((f) => !usadas.has(f))

console.log(`${eventos.length} eventos, ${ids.size} ids únicos`)
const porCategoria = {}
for (const e of eventos) porCategoria[e.categoria] = (porCategoria[e.categoria] || 0) + 1
console.log('Por categoría:', porCategoria)
console.log(`${usadas.size} carteles referenciados de ${enDisco.length} extraídos`)
if (huerfanas.length) console.log('Sin usar:', huerfanas.join(', '))

if (errores.length) {
  console.error(`\n${errores.length} ERRORES:`)
  errores.forEach((e) => console.error(`  - ${e}`))
  process.exit(1)
}
console.log('\nSin errores.')
