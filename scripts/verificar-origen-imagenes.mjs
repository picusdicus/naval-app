#!/usr/bin/env node
/**
 * Verifica que las 9 filas tienen imagen_url de instagram-actividades/DcIj1xrj0tG-c*.jpg
 * Confirmando que vinieron del carrusel, no del documento
 */
import { obtenerSql } from '../api/_db.js'

async function verificar() {
  const sql = obtenerSql()

  console.log('=== VERIFICAR ORIGEN DE IMÁGENES ===\n')

  try {
    const result = await sql`
      SELECT
        origen_externo_id,
        titulo,
        imagen_url
      FROM actividades
      WHERE url_fuente LIKE '%DcIj1xrj0tG%'
         OR origen_externo_id LIKE '%DcIj1xrj0tG%'
      ORDER BY publicado_en DESC
      LIMIT 20
    `

    console.log(`Encontradas ${result.length} filas\n`)

    let deCarrusel = 0
    let deDocumento = 0

    result.forEach((row, i) => {
      const esCarrusel = row.imagen_url && row.imagen_url.includes('instagram-actividades/DcIj1xrj0tG')
      const esDocumento = row.imagen_url && row.imagen_url.includes('navalcarnero.es')

      console.log(`${i + 1}. ${row.titulo}`)
      console.log(`   imagen_url: ${row.imagen_url || 'NULL'}`)

      if (esCarrusel) {
        console.log(`   ✓ CARRUSEL (blob con shortcode)`)
        deCarrusel++
      } else if (esDocumento) {
        console.log(`   ✗ DOCUMENTO (URL de navalcarnero.es)`)
        deDocumento++
      } else if (row.imagen_url) {
        console.log(`   ? OTRO (${row.imagen_url.split('/')[0]})`)
      } else {
        console.log(`   ? SIN IMAGEN`)
      }
      console.log()
    })

    console.log(`\n=== RESULTADO ===`)
    console.log(`De carrusel: ${deCarrusel}`)
    console.log(`De documento: ${deDocumento}`)
    console.log(`Sin imagen: ${result.length - deCarrusel - deDocumento}`)

    if (deCarrusel === 9 && deDocumento === 0) {
      console.log(`\n✓ CONFIRMADO: Las 9 vinieron del carrusel de DcIj1xrj0tG`)
    }
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

verificar()
