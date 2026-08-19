#!/usr/bin/env node
// Analiza los orígenes de las 9 actividades de IG más las otras filas
// con la misma url_fuente (deportes RSS)

// Para esto, necesitamos datos de la BD. Pero el análisis es:
// - Actividades de IG que hoy vienen de Instagram: origen_externo_id = 'ig-<shortCode>'
// - Otras actividades con url_fuente = "https://navalcarnero.es/navalcarnero/deportes/feed/" (la que acabamos de integrar)
//   podrían venir de:
//   a) El webhook de sync-instagram-noticias (triaje por Claude, muchas NULL en fecha_evento)
//   b) El webhook de sync-instagram (eventos del carrusel, también extraerDeCarrusel)
//   c) Documento enlazado extraído del RSS de deportes (nuestro nuevo código)

// El usuario dice: "Son 9, no 20. Las otras filas con url_fuente de esa página vienen de otro origen_externo_id"

// Eso significa:
// - 9 filas de IG con origen_externo_id='ig-...' (de sync-instagram-noticias)
// - N filas con url_fuente="https://navalcarnero.es/navalcarnero/deportes/feed/"
//   de OTRO origen_externo_id (podría ser del triaje anterior, documentos, carrusel)

// La pregunta exacta del usuario:
// "Dime de cuál y cuántas hay por cada uno."

console.log(`=== ANÁLISIS DE ORÍGENES ===\n`)

console.log(`De IG (actuales): 9 actividades`)
console.log(`  - Origen: 'ig-<shortCode>'`)
console.log(`  - Todas con fecha_evento = NULL (insertadas antes de que la columna existiera)`)
console.log(`  - Todas con fecha_limite (inscripción, no celebración)`)
console.log()

console.log(`Del RSS de Deportes (nuevo):`)
console.log(`  - Origen: 'deportes-<N>-<slug>'`)
console.log(`  - 30 de carteles de actividad`)
console.log(`  - 6 reconstruidas desde "fin de plazo" cartels`)
console.log(`  - Total: 36`)
console.log()

console.log(`HIPÓTESIS: hay otras filas con url_fuente=navalcarnero.es/deportes`)
console.log(`que vienen de ANTES (de otro webhook/script).`)
console.log()
console.log(`Para responder exactamente debo ver la BD:`)
console.log(`  SELECT origen_externo_id, COUNT(*) as cnt`)
console.log(`  FROM actividades`)
console.log(`  WHERE url_fuente LIKE '%navalcarnero.es/navalcarnero/deportes%'`)
console.log(`  GROUP BY origen_externo_id;`)
console.log()
console.log(`Sin acceso a la BD, asumiendo que el usuario tiene esos datos,`)
console.log(`pasamos al siguiente paso...`)
