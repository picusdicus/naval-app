#!/usr/bin/env node
import { obtenerActividadesDeportivas } from '../api/_actividades-deportes-feed.js'

console.log('[Test] Integrando actividades deportivas...\n')

const resultadoDeportes = await obtenerActividadesDeportivas()

// Transformar al formato de eventos (como haría el cron)
const deportes = resultadoDeportes.actividades.map((a) => ({
  id: a.origen_externo_id,
  titulo: a.titulo,
  fecha: a.fecha_evento || a.fecha_limite,
  hora: null,
  lugar: 'Navalcarnero',
  categoria: a.categoria,
  subcategoria: null,
  origen: 'deportes',
  descripcion: '',
  url: a.url_fuente,
  imagen: a.imagen,
  fuente: 'Actividades Deportivas',
}))

console.log('Actividades transformadas:', deportes.length)
console.log('\nPrimeras 3:\n')

deportes.slice(0, 3).forEach((e, i) => {
  console.log(`${i+1}. ${e.titulo}`)
  console.log(`   ID: ${e.id}`)
  console.log(`   Fecha: ${e.fecha || 'NULL'}`)
  console.log(`   Origen: ${e.origen}`)
  console.log()
})

console.log('Últimas 3:\n')

deportes.slice(-3).forEach((e, i) => {
  console.log(`${deportes.length - 2 + i}. ${e.titulo}`)
  console.log(`   ID: ${e.id}`)
  console.log(`   Fecha: ${e.fecha || 'NULL'}`)
  console.log(`   Reconstruida: ${e.id.includes('plazo') ? 'Sí (desde plazo)' : 'No'}`)
  console.log()
})

console.log(`\n=== ESTADÍSTICAS ===`)
console.log(`Total: ${deportes.length}`)
console.log(`Con fecha: ${deportes.filter(e => e.fecha).length}`)
console.log(`Sin fecha (NULL): ${deportes.filter(e => !e.fecha).length}`)
console.log(`Reconstruidas desde plazo: ${deportes.filter(e => e.id.includes('plazo')).length}`)
