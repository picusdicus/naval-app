#!/usr/bin/env node
import { obtenerSql } from '../api/_db.js'

async function diagnostico() {
  const sql = obtenerSql()
  console.log('=== DIAGNÓSTICO COMPLETO ===\n')

  try {
    // 1. Posts y sus filas
    console.log('1. Filas por post:\n')
    const porPost = await sql`
      SELECT 
        SUBSTRING(origen_externo_id FROM 4 FOR 11) AS post,
        COUNT(*) AS cantidad,
        COUNT(CASE WHEN fecha_evento IS NOT NULL THEN 1 END) AS con_fecha_evento
      FROM actividades
      WHERE origen_externo_id LIKE 'ig-%'
        AND (origen_externo_id LIKE 'ig-Dbkgr2%'
          OR origen_externo_id LIKE 'ig-DbpqPM%'
          OR origen_externo_id LIKE 'ig-DcIj1%')
      GROUP BY 1
      ORDER BY post
    `

    porPost.forEach(row => {
      console.log(`Post ${row.post}: ${row.cantidad} filas (${row.con_fecha_evento} con fecha_evento)`)
    })

    // 2. Actividades reales (dedup por (fecha_evento, titulo))
    console.log('\n2. Actividades distintas (por fecha + título):\n')
    const actividades = await sql`
      SELECT 
        fecha_evento,
        titulo,
        COUNT(DISTINCT origen_externo_id) AS posts
      FROM actividades
      WHERE origen_externo_id LIKE 'ig-%'
        AND (origen_externo_id LIKE 'ig-Dbkgr2%'
          OR origen_externo_id LIKE 'ig-DbpqPM%'
          OR origen_externo_id LIKE 'ig-DcIj1%')
      GROUP BY 1, 2
      ORDER BY fecha_evento NULLS FIRST, titulo
    `

    actividades.forEach(row => {
      const fe = row.fecha_evento || 'NULL'
      console.log(`${fe.padEnd(11)} | ${row.titulo.padEnd(40)} | ${row.posts} posts`)
    })

    console.log(`\nTotal actividades reales: ${actividades.length}`)

    // 3. Error de datos: id vs titulo
    console.log('\n3. Chequeo id/titulo:\n')
    const mismatches = await sql`
      SELECT 
        origen_externo_id,
        titulo
      FROM actividades
      WHERE origen_externo_id LIKE 'ig-Dbkgr2%'
        AND titulo LIKE '%tenis%'
    `

    mismatches.forEach(row => {
      console.log(`ID: ${row.origen_externo_id}`)
      console.log(`Título: ${row.titulo}\n`)
    })

    // 4. Codificación rota
    console.log('4. Primeras descripciones (check codificación):\n')
    const desc = await sql`
      SELECT 
        origen_externo_id,
        SUBSTRING(descripcion FROM 1 FOR 100) AS descripcion_snippet
      FROM actividades
      WHERE origen_externo_id LIKE 'ig-Dbkgr2%'
        OR origen_externo_id LIKE 'ig-DbpqPM%'
      LIMIT 5
    `

    desc.forEach(row => {
      console.log(`${row.origen_externo_id}:`)
      console.log(`  ${row.descripcion_snippet}\n`)
    })

  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

diagnostico()
