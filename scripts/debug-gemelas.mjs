#!/usr/bin/env node
import { obtenerActividadesDeportivas } from '../api/_actividades-deportes-feed.js'

const r = await obtenerActividadesDeportivas()

console.log('=== BÚSQUEDA DE GEMELAS ===\n')

// Carteles de actividad (no reconstruidas)
const originales = r.actividades.filter(a => !a.reconstruido_desde_plazo)

console.log('Buscando en:', originales.length, 'actividades originales\n')

// Títulos que buscar
const aBuscar = ['TENIS DE MESA', 'TORNEO DE FÚTBOL', 'TORNEO DE FUTBOL']

const normalizarTitulo = (t) => t.toUpperCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()

aBuscar.forEach(busco => {
  const buscaNorm = normalizarTitulo(busco)
  console.log(`Buscando: "${busco}" → normalizado: "${buscaNorm}"`)

  const encontrados = originales.filter(a => {
    const aNorm = normalizarTitulo(a.titulo)
    const match = aNorm === buscaNorm || aNorm.includes(buscaNorm) || buscaNorm.includes(aNorm)
    return match
  })

  if (encontrados.length > 0) {
    console.log(`  ✓ Encontrados (${encontrados.length}):`)
    encontrados.forEach(e => console.log(`    - "${e.titulo}" (${e.origen_externo_id})`))
  } else {
    console.log(`  ✗ No encontrados`)
  }
  console.log()
})
