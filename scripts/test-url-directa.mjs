#!/usr/bin/env node
/**
 * Test: pasar URLs directas del CDN de Instagram a Anthropic
 * Verifica si Anthropic puede descargar imágenes desde Instagram
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// URL real del CDN de Instagram del dataset DciM41sD_3r
const urlImagen = 'https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/787484332_1399405565714787_2232746921511003609_n.jpg?stp=c0.87.1054.1317a_dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzE5Nzg2MzE4MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad'

console.log('Probando pasar URL directa del CDN de Instagram a Anthropic...')
console.log(`URL: ${urlImagen.slice(0, 80)}...`)

try {
  const respuesta = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 100,
    system: 'Describe esta imagen brevemente.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'url',
              url: urlImagen,
            },
          },
        ],
      },
    ],
  })

  console.log('✅ Éxito: Anthropic descargó la imagen')
  console.log(respuesta.content[0])
} catch (err) {
  console.error('❌ Error:')
  console.error(`Code: ${err.status}`)
  console.error(`Message: ${err.message}`)
  if (err.error) {
    console.error(`Full error:`, JSON.stringify(err.error, null, 2))
  }
}
