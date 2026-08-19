#!/usr/bin/env node
import { obtenerSql } from '../api/_db.js'

async function verificar() {
  const sql = obtenerSql()
  try {
    const result = await sql`
      SELECT 
        fecha_evento,
        titulo,
        fecha_limite
      FROM actividades
      WHERE origen_externo_id LIKE 'ig-DcIj1%'
      LIMIT 1
    `
    console.log('✓ Columna fecha_evento existe')
    console.log(`Registro de prueba:`)
    if (result.length > 0) {
      console.log(`  titulo: ${result[0].titulo}`)
      console.log(`  fecha_evento: ${result[0].fecha_evento || 'NULL'}`)
      console.log(`  fecha_limite: ${result[0].fecha_limite || 'NULL'}`)
    } else {
      console.log('  (sin registros con ig-DcIj1)')
    }
  } catch (err) {
    console.error('✗ Error:', err.message)
    process.exit(1)
  }
}

verificar()
