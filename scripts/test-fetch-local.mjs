#!/usr/bin/env node
/**
 * Test: puede Node.js descargar imágenes del CDN de Instagram localmente?
 */

const urlImagen = 'https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/787484332_1399405565714787_2232746921511003609_n.jpg?stp=c0.87.1054.1317a_dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzE5Nzg2MzE4MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad'

console.log('Probando fetch local desde Node contra CDN de Instagram...')
console.log(`URL: ${urlImagen.slice(0, 80)}...`)

try {
  const res = await fetch(urlImagen)
  console.log(`HTTP ${res.status}: ${res.statusText}`)
  
  if (res.ok) {
    const buffer = await res.arrayBuffer()
    const sizeKb = (buffer.byteLength / 1024).toFixed(2)
    console.log(`✅ Éxito: Descargada imagen de ${sizeKb} KB`)
    console.log(`✅ Conversión a base64 sería viable: ${(buffer.byteLength * 4 / 3 / 1024).toFixed(2)} KB base64`)
  } else {
    console.log(`❌ Fallo: ${res.status} ${res.statusText}`)
  }
} catch (err) {
  console.error(`❌ Error de fetch:`, err.message)
}
