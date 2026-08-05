import fs from 'fs'

const envPath = '.env.local'
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=')
    if (key && !key.startsWith('#')) {
      process.env[key] = rest.join('=').replace(/^"/, '').replace(/"$/, '')
    }
  })
}

import { obtenerSql } from './api/_db.js'

async function check() {
  try {
    const sql = obtenerSql()
    const result = await sql`SELECT titulo, origen_externo_id, imagen_url FROM actividades ORDER BY creado_en DESC LIMIT 10`

    console.log(`\nActividades y sus IDs:\n`)
    for (const a of result) {
      console.log(`${a.titulo}`)
      console.log(`  ID: ${a.origen_externo_id}`)
      console.log(`  Img: ${a.imagen_url}`)
      console.log()
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

check()
