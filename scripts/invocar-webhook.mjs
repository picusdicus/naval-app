#!/usr/bin/env node
import fs from 'fs'

const secret = process.env.NOTICIAS_SYNC_SECRET || 'scUC4e9lZusY2pb4CAi2XMBCGE4PS7'
const dataset = JSON.parse(fs.readFileSync('./scripts/post-DcIj1xrj0tG-dataset.json', 'utf-8'))

async function invocar() {
  console.log('Invocando webhook...\n')
  
  try {
    const response = await fetch('https://naval-app-one.vercel.app/api/sync-instagram-noticias', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify(dataset),
    })

    const result = await response.json()
    console.log('✓ Webhook respondió')
    console.log(JSON.stringify(result, null, 2))

    if (result.errores?.length > 0) {
      console.log('\n❌ Errores:')
      result.errores.forEach(e => console.log(`  - ${e}`))
    }
  } catch (err) {
    console.error('✗ Error:', err.message)
    process.exit(1)
  }
}

invocar()
