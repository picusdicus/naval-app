#!/usr/bin/env node
// Script de diagnóstico: reprocesa el post DcIj1xrG0tG para ver qué devuelve Claude en extraerDeCarrusel

import { extraerDeCarrusel } from './api/_actividades-parser.js'

// El post DcIj1xrG0tG tiene al menos estos carteles. Usamos el alt literal que el usuario pasó:
const carrusel = [
  {
    alt: "FIESTAS PATRONALES 2026 TARDEO DEPORTIVO AQUAZUMBA Y BAÑO CON DJ PIWI. VIERNES, 21 DE AGOSTO. Horario: de 19.30h. a 22.30h. Inscripciones: hasta 20 de agosto en la Concejalía de Deportes…",
    imagen: null, // No necesitamos la imagen para este diagnóstico
  },
  // Otros carteles del post (sin conocer los alts, lo dejaremos en un solo cartel para enfocarse)
]

const publicado = '2026-08-17' // Fecha del post según el contexto

console.log('📋 Diagnóstico: extraerDeCarrusel para post DcIj1xrG0tG')
console.log('📅 Fecha de publicación del post:', publicado)
console.log('🖼️ Carruseles enviados:', carrusel.length)
console.log('---')

try {
  const resultado = await extraerDeCarrusel(carrusel, publicado)
  console.log('\n✅ Respuesta de extraerDeCarrusel:')
  console.log(JSON.stringify(resultado, null, 2))

  if (resultado.length > 0) {
    const primera = resultado[0]
    console.log('\n🔍 Análisis de la primera actividad:')
    console.log(`  Título: "${primera.titulo}"`)
    console.log(`  fechaEvento: ${primera.fechaEvento || '(NULL)'}`)
    console.log(`  fechaLimite: ${primera.fechaLimite || '(NULL)'}`)
    console.log(`  Horario: ${primera.horario || '(NULL)'}`)
    console.log(`  Lugar: ${primera.lugar || '(NULL)'}`)

    if (!primera.fechaEvento) {
      console.log('\n⚠️  PROBLEMA CONFIRMADO: fechaEvento es NULL')
      console.log('   El cartel claramente dice "VIERNES, 21 DE AGOSTO"')
      console.log('   Claude debería haber extraído: 2026-08-21')
    }
  }
} catch (err) {
  console.error('❌ Error en extraerDeCarrusel:', err.message)
  console.error(err)
}
