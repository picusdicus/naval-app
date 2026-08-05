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
    const result = await sql`SELECT COUNT(*) as total FROM actividades`
    const total = result[0]?.total || 0
    console.log(`Total de actividades: ${total}`)

    if (total > 0) {
      const latest = await sql`SELECT titulo, imagen_url FROM actividades ORDER BY creado_en DESC LIMIT 3`
      console.log(`\nÚltimas 3:`)
      for (const a of latest) {
        console.log(`• ${a.titulo} - Img: ${a.imagen_url ? 'SÍ' : 'NO'}`)
      }
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

check()
