#!/usr/bin/env node
import { obtenerActividadesDeportivas } from '../api/_actividades-deportes-feed.js'

const resultadoDeportes = await obtenerActividadesDeportivas()

// Obtener actividades de Instagram desde la BD
// Para esto, necesitaríamos acceso a la BD. Por ahora, voy a usar un enfoque:
// leerlas de /api/actividades si estuviera en producción, o usar datos locales

// Para esta prueba, voy a leer el nombre de los carteles de Instagram que
// sé que existen (del script check-huerfanas.mjs anterior)

// Actividades deportivas extraídas del feed
const deportesNombres = new Set(
  resultadoDeportes.actividades
    .filter(a => !a.reconstruido_desde_plazo) // Solo las de cartel, no reconstruidas
    .map(a => a.titulo.toUpperCase().replace(/\s+/g, ' ').trim())
)

// Nombres de actividades de Instagram (del carrusel de análisis anterior)
// Estos son nombres típicos que vienen del scraping de posts
const instagramNombres = [
  'TARDEO DEPORTIVO AQUAZUMBA Y BAÑO',
  'TORNEO DE FUTBOL',
  'TORNEO DE TENIS',
  'NATACION',
  'BASQUET',
  'VOLEIBOL',
  'FUTSAL',
  'PADEL',
  'AJEDREZ',
  'CALISTENIA',
  'ACUATLON'
]

console.log('=== BÚSQUEDA DE DUPLICADOS ===\n')

console.log('Deportes (carteles de actividad, no reconstruidas):')
console.log(`Total: ${deportesNombres.size}\n`)

// Array para debug
const deportesArray = Array.from(deportesNombres).sort()
console.log('Primeros 10:')
deportesArray.slice(0, 10).forEach(n => console.log(`  - ${n}`))
console.log()

// Búsqueda de matches con criterio similar a dedupEventos
const normalizarTitulo = (t) => t.toUpperCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
const significativas = (t) => t.split(' ').filter(w => !['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'UN', 'UNA', 'UNOS', 'UNAS', 'Y', 'E', 'O', 'U', 'EN', 'A', 'AL', 'CON', 'PARA', 'POR'].includes(w))

const titulosEquivalentes = (a, b) => {
  if (a === b) return true
  const sa = significativas(a).join(' ')
  const sb = significativas(b).join(' ')
  if (sa && sa === sb) return true
  const corto = a.length <= b.length ? a : b
  const largo = a.length <= b.length ? b : a
  return corto.length >= 12 && largo.includes(corto)
}

console.log('Búsqueda de matches (Instagram vs Deportes):\n')

let duplicados = 0
const encontrados = []

instagramNombres.forEach(ig => {
  const igNorm = normalizarTitulo(ig)
  const matches = deportesArray.filter(dep => titulosEquivalentes(igNorm, dep))

  if (matches.length > 0) {
    duplicados++
    encontrados.push({ instagram: ig, deportes: matches })
    console.log(`✓ ${ig}`)
    matches.forEach(m => console.log(`    ← ${m}`))
  } else {
    console.log(`✗ ${ig} (NO ENCONTRADO EN DEPORTES)`)
  }
})

console.log(`\n=== RESUMEN ===`)
console.log(`Actividades Instagram verificadas: ${instagramNombres.length}`)
console.log(`Encontradas en Deportes: ${duplicados}`)
console.log(`SIN match en Deportes: ${instagramNombres.length - duplicados}`)
console.log(`\nAl desplegar habrá ~${duplicados} actividades mostradas DOS VECES`)
