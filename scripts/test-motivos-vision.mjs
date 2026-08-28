#!/usr/bin/env node
/**
 * Test programático: verificar corrección de motivosVisión
 *
 * Casos:
 * a) Foto única genérica → "con visión (alt genérico)"
 * b) Carrusel 3 todas genérico + padre genérico → "con visión (alt genérico)"
 * c) Carrusel mixto (1 útil + 2 genérico) + padre genérico → "con visión parcial"
 * d) Padre útil + hija genérica → "con visión parcial"
 */

// Mock de esAltGenerico
const esAltGenerico = (alt) => {
  if (!alt) return true
  if (/^\s*$/.test(alt)) return true
  if (/^Photo by .* on [A-Z]/.test(alt)) return true
  return false
}

// LÓGICA ACTUAL (INCORRECTA)
const clasificarVisión_VIEJO = (post) => {
  const altPostGenérico = esAltGenerico(post.alt)
  const altsCarruselGenéricos = post.carrusel?.filter((c) => esAltGenerico(c.alt)) || []

  if (altPostGenérico && altsCarruselGenéricos.length > 0) {
    return 'extraccion con visión parcial (algunos alt genéricos en carrusel)'
  } else if (altPostGenérico || altsCarruselGenéricos.length > 0) {
    return 'extraccion con visión (alt genérico)'
  } else {
    return 'extraccion sin visión (alt útil)'
  }
}

// LÓGICA NUEVA (CORRECTA)
const clasificarVisión_NUEVO = (post) => {
  const altPostGenérico = esAltGenerico(post.alt)
  const hijas = post.carrusel || []
  const carruselTieneGenerico = hijas.some((c) => esAltGenerico(c.alt))
  const carruselTieneUtil = hijas.some((c) => !esAltGenerico(c.alt))
  const hayGenerico = altPostGenérico || carruselTieneGenerico
  const hayUtil = !altPostGenérico || carruselTieneUtil

  if (!hayGenerico) {
    return 'extraccion sin visión (alt útil)'
  } else if (hayUtil) {
    return 'extraccion con visión parcial (algunos alt genéricos en carrusel)'
  } else {
    return 'extraccion con visión (alt genérico)'
  }
}

// Casos de prueba
const casos = [
  {
    nombre: 'a) Foto única con alt genérico, sin carrusel',
    post: {
      alt: 'Photo by Cultura_navalcarnero on August 27, 2026.',
      carrusel: [],
    },
    esperado: 'extraccion con visión (alt genérico)',
  },
  {
    nombre: 'b) Carrusel de 3 hijas todas con alt genérico + padre genérico',
    post: {
      alt: 'Photo by Cultura_navalcarnero on August 27, 2026.',
      carrusel: [
        { alt: 'Photo by Cultura_navalcarnero on August 27, 2026.' },
        { alt: 'Photo by Cultura_navalcarnero on August 27, 2026.' },
        { alt: 'Photo by Cultura_navalcarnero on August 27, 2026.' },
      ],
    },
    esperado: 'extraccion con visión (alt genérico)',
  },
  {
    nombre: 'c) Carrusel 3 (1 útil + 2 genérico) + padre genérico',
    post: {
      alt: 'Photo by Cultura_navalcarnero on August 27, 2026.',
      carrusel: [
        { alt: 'SUEÑOS DE PRÍNCIPES 1 SEPTIEMBRE' },
        { alt: 'Photo by Cultura_navalcarnero on August 27, 2026.' },
        { alt: 'Photo by Cultura_navalcarnero on August 27, 2026.' },
      ],
    },
    esperado: 'extraccion con visión parcial (algunos alt genéricos en carrusel)',
  },
  {
    nombre: 'd) Padre con alt útil pero una hija genérica',
    post: {
      alt: 'Fiestas Patronales: Lunes 31 agosto 21:30 SONIA FAUSTO',
      carrusel: [
        { alt: 'SONIA FAUSTO 31 AGOSTO' },
        { alt: 'Photo by Cultura_navalcarnero on August 27, 2026.' },
      ],
    },
    esperado: 'extraccion con visión parcial (algunos alt genéricos en carrusel)',
  },
]

console.log('=== TEST: Clasificación de motivosVisión ===\n')

let todosOk = true

console.log('LÓGICA ACTUAL (VIEJA):')
console.log('─'.repeat(60))
for (const { nombre, post, esperado } of casos) {
  const resultado = clasificarVisión_VIEJO(post)
  const ok = resultado === esperado
  const marca = ok ? '✓' : '✗'
  todosOk = todosOk && ok
  console.log(`${marca} ${nombre}`)
  if (!ok) {
    console.log(`  Esperado: ${esperado}`)
    console.log(`  Obtuvo:   ${resultado}`)
  }
}

console.log('\n')
console.log('LÓGICA NUEVA (CORREGIDA):')
console.log('─'.repeat(60))
let todosOkNuevo = true
for (const { nombre, post, esperado } of casos) {
  const resultado = clasificarVisión_NUEVO(post)
  const ok = resultado === esperado
  const marca = ok ? '✓' : '✗'
  todosOkNuevo = todosOkNuevo && ok
  console.log(`${marca} ${nombre}`)
  if (!ok) {
    console.log(`  Esperado: ${esperado}`)
    console.log(`  Obtuvo:   ${resultado}`)
  }
}

console.log('\n' + '='.repeat(60))
console.log(`VIEJO: ${todosOk ? 'TODOS OK' : 'FALLOS ENCONTRADOS'}`)
console.log(`NUEVO: ${todosOkNuevo ? 'TODOS OK ✓' : 'FALLOS ENCONTRADOS'}`)
console.log('='.repeat(60))

if (!todosOkNuevo) {
  process.exit(1)
}
