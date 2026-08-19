#!/usr/bin/env node
import { obtenerActividadesDeportivas } from '../api/_actividades-deportes-feed.js'
import { claveTitulo, titulosEquivalentes } from '../src/lib/dedupEventos.js'

const r = await obtenerActividadesDeportivas()

// Actividades del feed (como llegarían en el cron a combinarEventos)
const deportesEventos = r.actividades
  .filter(a => !a.reconstruido_desde_plazo)
  .map(a => ({
    titulo: a.titulo,
    fecha: a.fecha_evento || a.fecha_limite, // Como useEventosPublicos hace
  }))

console.log('=== CONTEO DE DUPLICADOS REALES ===\n')

// Simulación: actividades típicas de Instagram (nombres y fechas de cómo llegan)
// Estos son ejemplos de posts que el scraper extrae con fecha_evento (día de celebración)
// pero el feed deportivo los tiene con fecha_evento: null (sin fecha)
const possibleDuplicados = [
  { titulo: 'TARDEO DEPORTIVO AQUAZUMBA Y BAÑO', fechaIG: '2026-08-21' },
  { titulo: 'NATACION', fechaIG: '2026-08-30' },
  { titulo: 'VOLEIBOL', fechaIG: null }, // Si IG tampoco tiene fecha
  { titulo: 'TORNEO DE TENIS', fechaIG: '2026-08-27' },
  { titulo: 'TORNEO DE FUTBOL', fechaIG: '2026-08-27' },
  { titulo: 'AJEDREZ', fechaIG: '2026-09-05' },
  { titulo: 'CALISTENIA', fechaIG: '2026-09-02' },
  { titulo: 'CARRERA GALGOS', fechaIG: null },
  { titulo: 'PUERTAS ABIERTAS PATINAJE', fechaIG: null },
]

console.log('Buscando potenciales duplicados entre IG y Feed Deportivo:')
console.log('(Criterio: fecha + título equivalente)\n')

let duplicadosReales = 0
let noDedup = []

possibleDuplicados.forEach((ig, idx) => {
  const igClave = claveTitulo(ig.titulo)

  // Buscar en feed deportivo
  const match = deportesEventos.find(dep => {
    const depClave = claveTitulo(dep.titulo)
    // Criterio exacto de dedup
    return ig.fechaIG && dep.fecha === ig.fechaIG && titulosEquivalentes(igClave, depClave)
  })

  if (match) {
    duplicadosReales++
    console.log(`✓ [${idx+1}] SERÍA DEDUPLICADO: "${ig.titulo}" (${ig.fechaIG})`)
  } else {
    const matchPorTitulo = deportesEventos.find(dep => {
      const depClave = claveTitulo(dep.titulo)
      return titulosEquivalentes(igClave, depClave)
    })

    if (matchPorTitulo) {
      console.log(`✗ [${idx+1}] NO DEDUP (fecha no coincide):`)
      console.log(`       IG: "${ig.titulo}" (${ig.fechaIG || 'NULL'})`)
      console.log(`       Feed: "${matchPorTitulo.titulo}" (${matchPorTitulo.fecha || 'NULL'})`)
      noDedup.push({
        tipo: 'fecha_no_coincide',
        ig: ig.titulo,
        igFecha: ig.fechaIG,
        feed: matchPorTitulo.titulo,
        feedFecha: matchPorTitulo.fecha,
      })
    } else {
      console.log(`✗ [${idx+1}] NO ENCONTRADO en Feed: "${ig.titulo}"`)
    }
  }
})

console.log(`\n=== RESUMEN ===`)
console.log(`Total verificados: ${possibleDuplicados.length}`)
console.log(`Se deduplicarían: ${duplicadosReales}`)
console.log(`SE VERÍAN DUPLICADOS: ${possibleDuplicados.length - duplicadosReales}`)

if (noDedup.length > 0) {
  console.log(`\nDetalles de no-dedup:`)
  noDedup.forEach(d => {
    if (d.tipo === 'fecha_no_coincide') {
      console.log(`  • "${d.ig}" (IG ${d.igFecha}) vs Feed "${d.feed}" (${d.feedFecha})`)
    }
  })
  console.log(`\nCONCLUSIÓN: El número de duplicados REALES es ALTO porque:`)
  console.log(`• IG tiene fechas de CELEBRACIÓN`)
  console.log(`• Feed tiene fechas de CIERRE DE INSCRIPCIONES o NADA`)
  console.log(`• El criterio fecha+título falla cuando las fechas no coinciden`)
}
