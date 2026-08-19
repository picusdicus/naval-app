#!/usr/bin/env node
import { obtenerActividadesDeportivas } from '../api/_actividades-deportes-feed.js'

console.log('[Test] Extrayendo actividades del feed de Deportes...\n')

try {
  const resultado = await obtenerActividadesDeportivas()

  console.log('=== LISTA COMPLETA DE CARTELES EXTRAÍDOS ===\n')

  // Mostrar cada actividad extraída
  console.log(`ACTIVIDADES (${resultado.actividades.length} total):\n`)
  resultado.actividades.forEach((a, i) => {
    console.log(`${i + 1}. ${a.titulo}`)
    console.log(`   Fecha: ${a.fecha_evento}`)
    console.log(`   ID: ${a.origen_externo_id}`)
    console.log(`   Imagen: ${a.imagen}`)
    console.log()
  })

  console.log(`\n"FIN DE PLAZO" DETECTADOS (${resultado.detectadasFinPlazo} total):`)
  console.log('(Sin detalles por ahora - se están detectando pero no se guardan)\n')

  console.log(`\nRESUMEN:`)
  console.log(`Total carteles detectados: ${resultado.actividades.length + resultado.detectadasFinPlazo}`)
  console.log(`Actividades reales: ${resultado.actividades.length}`)
  console.log(`"Fin de plazo": ${resultado.detectadasFinPlazo}`)

  process.exit(0)
} catch (err) {
  console.error('[ERROR]', err.message)
  console.error(err.stack)
  process.exit(1)
}
