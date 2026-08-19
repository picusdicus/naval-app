#!/usr/bin/env node
import { obtenerActividadesDeportivas } from '../api/_actividades-deportes-feed.js'

const r = await obtenerActividadesDeportivas()

console.log('=== ACTIVIDADES RECONSTRUIDAS DESDE "FIN DE PLAZO" ===\n')

const huerfanas = r.actividades.filter(a => a.reconstruido_desde_plazo)

console.log('Encontradas:', huerfanas.length, '\n')

huerfanas.forEach((a, i) => {
  console.log(`${i+1}. ${a.titulo}`)
  console.log(`   ID: ${a.origen_externo_id}`)
  console.log(`   Cierre de inscripciones: ${a.fecha_limite || 'desconocida'}`)
  console.log(`   Fecha de celebración: ${a.fecha_evento || 'NULL (desconocida)'}`)
  console.log()
})

console.log('\n=== RESUMEN ===')
console.log(`Total actividades: ${r.actividades.length}`)
console.log(`- De carteles de actividad: ${r.actividades.length - huerfanas.length}`)
console.log(`- Reconstruidas desde plazo: ${huerfanas.length}`)
console.log(`- Total "fin de plazo" detectados: ${r.detectadasFinPlazo}`)
