#!/usr/bin/env node
import { obtenerActividadesDeportivas } from '../api/_actividades-deportes-feed.js'

const r = await obtenerActividadesDeportivas()

console.log('=== AUDITORÍA DE FECHAS EN FEED DEPORTIVO ===\n')

const conFecha = r.actividades.filter(a => a.fecha_evento)
const sinFecha = r.actividades.filter(a => !a.fecha_evento)

console.log(`Total actividades: ${r.actividades.length}`)
console.log(`Con fecha_evento: ${conFecha.length}`)
console.log(`SIN fecha_evento: ${sinFecha.length}`)
console.log(`Reconstruidas desde plazo: ${r.actividades.filter(a => a.reconstruido_desde_plazo).length}`)

console.log('\n=== ACTIVIDADES SIN FECHA_EVENTO ===\n')

sinFecha.forEach((a, i) => {
  // Extraer número de fichero del origen_externo_id (ej: deportes-2-tardeo-deportivo → 2)
  const match = a.origen_externo_id.match(/^deportes-(\d+)-/)
  const numero = match ? match[1] : '?'

  console.log(`${i+1}. [${numero}] ${a.titulo}`)
  console.log(`   ID: ${a.origen_externo_id}`)
  console.log(`   URL imagen: ${a.imagen}`)
  console.log(`   Plazo: ${a.fecha_limite || 'NULL'}`)
  console.log()
})

console.log('=== ANÁLISIS DE PATRÓN ===\n')

// Ver si hay patrón en los números
const numeros = sinFecha
  .map(a => {
    const match = a.origen_externo_id.match(/^deportes-(\d+)-/)
    return match ? parseInt(match[1]) : null
  })
  .filter(n => n !== null)
  .sort((a, b) => a - b)

console.log(`Números de cartel sin fecha: ${numeros.join(', ')}`)
console.log(`Total: ${numeros.length}`)

// Ver si son números altos (fin de la galería)
const numBajos = numeros.filter(n => n <= 20)
const numAltos = numeros.filter(n => n > 20)

if (numAltos.length > 0) {
  console.log(`\nPatrón observado: Muchos sin fecha son carteles altos (${numAltos.join(', ')})`)
  console.log(`→ Posible: truncamiento de la galería por límite de caracteres/bytes`)
} else if (numBajos.length > 0) {
  console.log(`\nPatrón observado: Sin fecha están distribuidos a lo largo (${numeros.join(', ')})`)
  console.log(`→ Posible: esos carteles no llevan fecha en el título original`)
}
