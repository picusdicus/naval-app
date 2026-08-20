import { obtenerSql } from '../api/_db.js'

const sql = obtenerSql()

const result = await sql`
  SELECT origen_externo_id, COUNT(*) as count
  FROM actividades
  WHERE origen_externo_id LIKE 'ig-%'
  GROUP BY origen_externo_id
  ORDER BY count DESC
`

console.log('Actividades con origen_externo_id ig-*:')
console.table(result)

const total = await sql`
  SELECT COUNT(*) as total FROM actividades WHERE origen_externo_id LIKE 'ig-%'
`
console.log('\nTotal:', total[0].total)
