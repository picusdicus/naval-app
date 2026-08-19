#!/usr/bin/env node
import { obtenerActividadesDeportivas } from '../api/_actividades-deportes-feed.js'

const resultado = await obtenerActividadesDeportivas()

console.log('=== VERIFICACIÓN DE "FIN DE PLAZO" HUÉRFANOS ===\n')

// Extraer nombres de actividades del "fin de plazo"
const finDePlazoNombres = [
  'PUERTA ABIERTAS RUGBY',
  'AQUATLÓN',
  'DUATLÓN',
  'PETANCA',
  'TORNEO DE PADEL'
]

const actividadesNombres = resultado.actividades.map(a => a.titulo.toUpperCase())

console.log('Buscando actividades gemelas para cada "fin de plazo":\n')

finDePlazoNombres.forEach(nombre => {
  const existe = actividadesNombres.some(a => a.includes(nombre))
  const emoji = existe ? '✓' : '✗ HUÉRFANO'

  const gemela = resultado.actividades.find(a => a.titulo.toUpperCase().includes(nombre))
  if (gemela) {
    console.log(`${emoji} ${nombre}`)
    console.log(`   → Encontrada: "${gemela.titulo}" (${gemela.fecha_evento || 'sin fecha explícita'})`)
  } else {
    console.log(`${emoji} ${nombre}`)
    console.log(`   → NO ENCONTRADA: Esta actividad se perdería si solo existe como plazo`)
  }
  console.log()
})

console.log('\n=== RESUMEN ===')
console.log(`Total actividades extraídas: ${resultado.actividades.length}`)
console.log(`Total "fin de plazo" detectados: ${resultado.detectadasFinPlazo}`)

const huerfanos = finDePlazoNombres.filter(nombre =>
  !actividadesNombres.some(a => a.includes(nombre))
)

if (huerfanos.length > 0) {
  console.log(`\n⚠️  ACTIVIDADES HUÉRFANAS (${huerfanos.length}):`)
  huerfanos.forEach(h => console.log(`   - ${h}`))
} else {
  console.log(`\n✓ Todas las actividades tienen su cartel (sin solo depender del plazo)`)
}
