#!/usr/bin/env node
import { obtenerSql } from '../api/_db.js'

async function ver() {
  const sql = obtenerSql()
  
  try {
    const result = await sql`
      SELECT 
        origen_externo_id,
        titulo,
        fecha_evento,
        fecha_limite,
        actualizado_en
      FROM actividades
      WHERE origen_externo_id LIKE 'ig-DcIj1%'
      ORDER BY actualizado_en DESC
      LIMIT 15
    `

    console.log(`Encontradas ${result.length} filas de ig-DcIj1*:\n`)
    
    result.forEach(row => {
      console.log(`${row.origen_externo_id}`)
      console.log(`  título: ${row.titulo}`)
      console.log(`  fecha_evento: ${row.fecha_evento || 'NULL'}`)
      console.log(`  fecha_limite: ${row.fecha_limite || 'NULL'}`)
      console.log(`  actualizado: ${new Date(row.actualizado_en).toLocaleString()}`)
      console.log()
    })
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

ver()
