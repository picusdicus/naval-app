// Simular un post de Instagram real para probar el webhook

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

const SECRET = process.env.NOTICIAS_SYNC_SECRET || 'test-secret'
const URL = 'https://naval-app-one.vercel.app/api/sync-instagram-noticias'

// Post real del Ayuntamiento con URL a página de actividades
const payload = {
  posts: [
    {
      shortCode: 'test-real-xyz',
      caption: `Programación deportiva para las Fiestas Patronales 🏃‍♂️⚽
https://navalcarnero.es/navalcarnero/deportes/actividades-deportivas-fiestas-patronales-navalcarnero-2026/`,
      timestamp: new Date().toISOString(),
      imagen: 'https://navalcarnero.es/navalcarnero/deportes/wp-content/uploads/2026/08/poster-deportes.jpg',
      ownerUsername: 'ayuntamientonavalcarnero',
      url: 'https://www.instagram.com/p/test-real-xyz/',
      alt: 'Cartel con actividades deportivas de agosto y septiembre',
    }
  ]
}

async function test() {
  console.log(`POST a ${URL}`)
  console.log(`Auth: Bearer ${SECRET}\n`)

  try {
    const response = await fetch(URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    console.log(`Status: ${response.status}\n`)
    console.log('Resultado:')
    console.log(JSON.stringify(data, null, 2))

    if (data.actividades > 0) {
      console.log(`\n✓ Se crearon ${data.actividades} actividades`)
    } else if (data.errores?.length > 0) {
      console.log(`\n✗ Errores: ${data.errores.join(', ')}`)
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

test()
