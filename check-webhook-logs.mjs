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

    // Ver todas las actividades
    const result = await sql`SELECT COUNT(*) as total FROM actividades`
    const total = result[0]?.total || 0
    console.log(`Total de actividades en BD: ${total}`)

    // Ver noticias de Instagram (tipo noticia)
    const noticias = await sql`SELECT COUNT(*) as total FROM noticias_instagram`
    const totalNoticias = noticias[0]?.total || 0
    console.log(`Total de noticias de Instagram: ${totalNoticias}`)

    if (totalNoticias > 0) {
      const latest = await sql`SELECT titulo, urgente FROM noticias_instagram ORDER BY publicado_en DESC LIMIT 3`
      console.log(`\nÚltimas 3 noticias:`)
      for (const n of latest) {
        console.log(`  • ${n.titulo} (urgente: ${n.urgente})`)
      }
    }

    // Ver si hay registros recientes en actividades
    if (total > 0) {
      const latest = await sql`SELECT titulo FROM actividades ORDER BY creado_en DESC LIMIT 3`
      console.log(`\nÚltimas 3 actividades:`)
      for (const a of latest) {
        console.log(`  • ${a.titulo}`)
      }
    } else {
      console.log(`\n⚠️ Sin actividades — el webhook NO creó nada`)
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

check()
