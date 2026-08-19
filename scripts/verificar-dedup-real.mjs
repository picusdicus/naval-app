#!/usr/bin/env node
import { obtenerActividadesDeportivas } from '../api/_actividades-deportes-feed.js'
import { claveTitulo, titulosEquivalentes } from '../src/lib/dedupEventos.js'

const resultadoDeportes = await obtenerActividadesDeportivas()

// Simular lo que viene del feed de deportes
const deportesEventos = resultadoDeportes.actividades
  .filter(a => !a.reconstruido_desde_plazo) // Solo carteles, no reconstruidas
  .map((a) => ({
    id: a.origen_externo_id,
    titulo: a.titulo,
    fecha: a.fecha_evento || a.fecha_limite, // Como lo hace useEventosPublicos
    fechaEvento: a.fecha_evento,
    fechaLimite: a.fecha_limite,
    origen: 'deportes',
  }))

console.log('=== VERIFICACIÓN DE DEDUPLICACIÓN REAL ===\n')
console.log(`Actividades del feed de deportes: ${deportesEventos.length}`)
console.log(`Con fecha_evento: ${deportesEventos.filter(e => e.fechaEvento).length}`)
console.log(`Con fecha_limite como fallback: ${deportesEventos.filter(e => !e.fechaEvento && e.fechaLimite).length}`)
console.log()

// Simular actividades de Instagram (nombres típicos que vemos en posts)
const instagramActividades = [
  {
    id: 'ig-ABC123',
    titulo: 'Tardeo deportivo aquazumba y baño con DJ Piwi',
    fecha: '2026-08-21', // fecha_evento del post
    fechaEvento: '2026-08-21',
    fechaLimite: null,
    origen: 'instagram',
  },
  {
    id: 'ig-DEF456',
    titulo: 'Torneo de Tenis',
    fecha: '2026-08-27',
    fechaEvento: '2026-08-27',
    fechaLimite: null,
    origen: 'instagram',
  },
  {
    id: 'ig-GHI789',
    titulo: 'NATACIÓN 30 Agosto',
    fecha: '2026-08-30',
    fechaEvento: '2026-08-30',
    fechaLimite: null,
    origen: 'instagram',
  },
]

console.log(`Actividades de Instagram (simuladas): ${instagramActividades.length}\n`)

// Aplicar el criterio de dedup exacto de dedupEventos
console.log('Búsqueda de duplicados (fecha + título equivalente):\n')

let duplicadosReales = 0
const noDeduplicados = []

for (const ig of instagramActividades) {
  const igClave = claveTitulo(ig.titulo)

  const match = deportesEventos.find(dep => {
    const depClave = claveTitulo(dep.titulo)
    // Mismo criterio de dedup
    return ig.fecha === dep.fecha && titulosEquivalentes(igClave, depClave)
  })

  if (match) {
    duplicadosReales++
    console.log(`✓ DEDUPLICADO: "${ig.titulo}"`)
    console.log(`              + "${match.titulo}" (${match.fecha})`)
    console.log()
  } else {
    // Buscar por qué NO se deduplicó
    const matchPorTitulo = deportesEventos.find(dep => {
      const depClave = claveTitulo(dep.titulo)
      return titulosEquivalentes(igClave, depClave)
    })

    if (matchPorTitulo) {
      console.log(`✗ NO DEDUPLICADO (fechas no coinciden):`)
      console.log(`   Instagram: "${ig.titulo}" (${ig.fecha})`)
      console.log(`   Deportes:  "${matchPorTitulo.titulo}" (${matchPorTitulo.fecha})`)
    } else {
      console.log(`✗ NO ENCONTRADO EN DEPORTES: "${ig.titulo}"`)
    }
    console.log()
    noDeduplicados.push(ig)
  }
}

console.log(`\n=== RESUMEN ===`)
console.log(`Verificadas: ${instagramActividades.length}`)
console.log(`Deduplicadas por título+fecha: ${duplicadosReales}`)
console.log(`Se verán duplicadas: ${instagramActividades.length - duplicadosReales}`)

if (noDeduplicados.length > 0) {
  console.log(`\nRazones de no-dedup:`)
  noDeduplicados.forEach(e => {
    const deportesMatch = deportesEventos.find(d => {
      const igClave = claveTitulo(e.titulo)
      const depClave = claveTitulo(d.titulo)
      return titulosEquivalentes(igClave, depClave)
    })
    if (deportesMatch) {
      console.log(`  - "${e.titulo}": fecha distinta`)
      console.log(`    IG: ${e.fecha} | Deportes: ${deportesMatch.fecha}`)
    } else {
      console.log(`  - "${e.titulo}": no existe en deportes`)
    }
  })
}
