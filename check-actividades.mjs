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
    const result = await sql`SELECT id, titulo, imagen_url, fecha_limite FROM actividades ORDER BY creado_en DESC LIMIT 5`

    console.log(`\nÚltimas 5 actividades:\n`)
    for (const act of result) {
      const img = act.imagen_url ? '✓' : '✗ SIN IMAGEN'
      console.log(`• ${act.titulo}`)
      console.log(`  Imagen: ${img}`)
      if (act.imagen_url) console.log(`  URL: ${act.imagen_url}`)
      console.log()
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

check()
