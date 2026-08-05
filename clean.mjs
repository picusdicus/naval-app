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

async function clean() {
  const sql = obtenerSql()
  await sql`DELETE FROM actividades`
  console.log('✓ Borradas todas las actividades')
}

clean()
