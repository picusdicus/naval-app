#!/usr/bin/env node
/**
 * Lee las 9 filas de actividades del post DcIj1xrj0tG en producción.
 * Muestra los datos actuales (titulo, descripcion, fecha_evento, fecha_limite, url_fuente)
 */
import { obtenerSql } from '../api/_db.js'

async function listarFilas() {
  const sql = obtenerSql()

  console.log('=== FILAS DE PRODUCCIÓN (ANTES DEL REPROCESAMIENTO) ===\n')

  try {
    // Buscar filas del post DcIj1xrj0tG
    // El origen_externo_id de las hijas del carrusel será algo como ig-DcIj1xrj0tG-N
    // Nota: fecha_evento puede no existir aún si la migration no se ejecutó en Neon
    const result = await sql`
      SELECT
        origen_externo_id,
        titulo,
        descripcion,
        categoria,
        fecha_limite,
        horario,
        lugar,
        url_fuente,
        estado,
        publicado_en
      FROM actividades
      WHERE url_fuente LIKE '%DcIj1xrj0tG%'
         OR origen_externo_id LIKE '%DcIj1xrj0tG%'
      ORDER BY publicado_en DESC
      LIMIT 20
    `

    if (result.length === 0) {
      console.log('❌ No se encontraron filas con DcIj1xrj0tG\n')
      console.log('Buscando filas de Instagram más recientes...\n')
      const recent = await sql`
        SELECT
          origen_externo_id,
          titulo,
          fecha_evento,
          fecha_limite,
          url_fuente
        FROM actividades
        WHERE origen_externo_id LIKE 'ig-%'
        ORDER BY publicado_en DESC
        LIMIT 15
      `
      console.log(`Encontradas ${recent.length} filas de Instagram:\n`)
      recent.forEach((r, i) => {
        console.log(`${i + 1}. ${r.origen_externo_id}`)
        console.log(`   titulo: ${r.titulo}`)
        console.log(`   fecha_evento: ${r.fecha_evento || 'NULL'}`)
        console.log(`   fecha_limite: ${r.fecha_limite || 'NULL'}`)
        console.log(`   url: ${r.url_fuente}`)
        console.log()
      })
      return
    }

    console.log(`Encontradas ${result.length} filas:\n`)

    let conFechaEvento = 0
    result.forEach((row, i) => {
      console.log(`${i + 1}. ${row.origen_externo_id}`)
      console.log(`   titulo: ${row.titulo}`)
      console.log(`   descripcion: ${row.descripcion ? row.descripcion.substring(0, 80) + '...' : 'NULL'}`)
      console.log(`   categoria: ${row.categoria}`)
      console.log(`   fecha_limite: ${row.fecha_limite || 'NULL'}`)
      console.log(`   horario: ${row.horario || 'NULL'}`)
      console.log(`   lugar: ${row.lugar || 'NULL'}`)
      console.log(`   url_fuente: ${row.url_fuente}`)
      console.log(`   estado: ${row.estado}`)
      console.log()

      // Nota: fecha_evento no mostrada porque aún no existe en Neon
    })

    console.log(`=== RESUMEN ===`)
    console.log(`Total: ${result.length}`)
    console.log(`Nota: fecha_evento aún no visible (migration en Neon pendiente)`)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

listarFilas()
