import pg from 'pg'

const dbUrl = process.env.DATABASE_URL
const client = new pg.Client({ connectionString: dbUrl })

await client.connect()

const result = await client.query(`
  SELECT referencia_id, COUNT(*) as count, MAX(enviado_en) as ultimo
  FROM push_avisos
  WHERE referencia_id LIKE 'fiestas-%' AND referencia_id LIKE '% %'
  GROUP BY referencia_id
  ORDER BY count DESC
  LIMIT 10
`)

console.log('Avisos de fiestas con espacios en el ID:')
console.table(result.rows)

const total = await client.query(`
  SELECT COUNT(*) as total
  FROM push_avisos
  WHERE referencia_id LIKE 'fiestas-%' AND referencia_id LIKE '% %'
`)
console.log('\nTotal a borrar:', total.rows[0].total)

await client.end()
