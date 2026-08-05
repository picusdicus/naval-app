// Test para ver qué URLs de imagen hay en el HTML municipal

import { JSDOM } from 'jsdom'

async function test() {
  try {
    const url = 'https://navalcarnero.es/navalcarnero/deportes/actividades-deportivas-fiestas-patronales-navalcarnero-2026/'
    console.log(`Scrapeando: ${url}\n`)

    const res = await fetch(url)
    const html = await res.text()

    const dom = new JSDOM(html)
    const doc = dom.window.document

    // Buscar todas las imágenes en galerías
    const galeriaItems = doc.querySelectorAll('.gallery-item img')
    console.log(`Imágenes en galería: ${galeriaItems.length}\n`)

    for (const img of galeriaItems) {
      const alt = img.alt?.trim()
      const dataSrc = img.getAttribute('data-lazy-src')
      const src = img.src
      const dataSrc2 = img.getAttribute('data-src')

      console.log(`Título: ${alt}`)
      console.log(`  data-lazy-src: ${dataSrc || 'N/A'}`)
      console.log(`  src:           ${src || 'N/A'}`)
      console.log(`  data-src:      ${dataSrc2 || 'N/A'}`)

      // Intentar derivar la versión full-size
      if (dataSrc && dataSrc.includes('-150x150')) {
        const fullSize = dataSrc.replace(/-150x150\./, '.')
        console.log(`  → Full-size:   ${fullSize}`)
      }
      console.log()
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

test()
