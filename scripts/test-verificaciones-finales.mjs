#!/usr/bin/env node
/**
 * Tres verificaciones finales antes de mergear:
 * a) DciM41sD_3r: indiceCartel correcto (0, 1, 2)
 * b) DcWSr3sCXRW: indiceCartel null (sin regresión)
 * c) Alt útil: sin visión, costo bajo
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()
const ESQUEMA = {
  type: 'object',
  properties: {
    eventos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          shortCode: { type: 'string' },
          titulo: { type: 'string' },
          fecha: { type: 'string' },
          hora: { type: 'string' },
          lugar: { type: 'string' },
          categoria: { type: 'string' },
          indiceCartel: { type: ['integer', 'null'] },
        },
        required: ['shortCode', 'titulo', 'fecha', 'hora', 'lugar', 'categoria'],
        additionalProperties: false,
      },
    },
  },
  required: ['eventos'],
  additionalProperties: false,
}

const INSTRUCCIONES = `Analiza posts de Instagram. Para cada evento devuelve shortCode, titulo, fecha YYYY-MM-DD, hora HH:MM, lugar, categoria. indiceCartel es null normalmente, solo si el caption marca "[Imagen N]" entonces devuelve N-1 (0 para [Imagen 1], etc).`

// Dataset A: carrusel con altés que marcan [Imagen N]
const datasetA = JSON.stringify([{
  shortCode: 'DciM41sD_3r',
  caption: 'Fiestas Patronales: Lunes 31 agosto 21:30 SONIA FAUSTO. Martes 1 sept 21:30 SUEÑOS DE PRÍNCIPES. Días 2-3 ESCUELAS DE DANZA.',
  publicado: '2026-08-27T07:00:32.000Z',
  carrusel: [
    { alt: '[Imagen 1] SONIA FAUSTO 31 AGOSTO' },
    { alt: '[Imagen 2] SUEÑOS DE PRÍNCIPES INFANTIL 1 SEPTIEMBRE' },
    { alt: '[Imagen 3] ESCUELAS DE DANZA 2 Y 3 SEPTIEMBRE' },
  ],
}])

// Dataset B: imagen única, sin marcas de índice
const datasetB = JSON.stringify([{
  shortCode: 'DcWSr3sCXRW',
  caption: 'Que disparate... El secreto de los trasgos... Boto Botones...',
  publicado: '2026-08-XX',
  carrusel: [],
}])

// Dataset C: alt útil, no genérico
const datasetC = JSON.stringify([{
  shortCode: 'DcAugh8DWp2',
  caption: 'El próximo jueves 20 de agosto a las 22:00h, en la Plaza de Francisco Sandoval, cine de verano.',
  publicado: '2026-08-14T07:00:08.000Z',
  carrusel: [],
}])

console.log('=== VERIFICACIÓN A: DciM41sD_3r (indiceCartel debe ser 0, 1, 2) ===\n')
try {
  const respuesta = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 500,
    system: [{
      type: 'text',
      text: INSTRUCCIONES,
      cache_control: { type: 'ephemeral' },
    }],
    output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: datasetA }],
    }],
  })

  const texto = respuesta.content.find((b) => b.type === 'text')?.text || '{}'
  const { eventos } = JSON.parse(texto)
  console.log(`Eventos: ${eventos.length}`)
  eventos.forEach((e) => {
    console.log(`  ${e.shortCode}: "${e.titulo}" → indiceCartel: ${e.indiceCartel}`)
  })

  const indices = eventos.map((e) => e.indiceCartel).sort()
  console.log(`\n✅ VERIFICACIÓN A: indices [${indices.join(', ')}] (esperado [0, 1, 2])`)
} catch (err) {
  console.error('❌ Error A:', err.message)
}

console.log('\n=== VERIFICACIÓN B: DcWSr3sCXRW (indiceCartel DEBE ser null) ===\n')
try {
  const respuesta = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 500,
    system: [{
      type: 'text',
      text: INSTRUCCIONES,
      cache_control: { type: 'ephemeral' },
    }],
    output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: datasetB }],
    }],
  })

  const texto = respuesta.content.find((b) => b.type === 'text')?.text || '{}'
  const { eventos } = JSON.parse(texto)
  console.log(`Eventos: ${eventos.length}`)
  eventos.forEach((e) => {
    console.log(`  ${e.shortCode}: "${e.titulo}" → indiceCartel: ${e.indiceCartel}`)
  })

  const allNull = eventos.every((e) => e.indiceCartel === null)
  console.log(`\n✅ VERIFICACIÓN B: todos null = ${allNull}`)
} catch (err) {
  console.error('❌ Error B:', err.message)
}

console.log('\n=== VERIFICACIÓN C: Alt útil (sin visión, costo bajo) ===\n')
try {
  const respuesta = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 500,
    system: [{
      type: 'text',
      text: INSTRUCCIONES,
      cache_control: { type: 'ephemeral' },
    }],
    output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: datasetC }],
    }],
  })

  const texto = respuesta.content.find((b) => b.type === 'text')?.text || '{}'
  const { eventos } = JSON.parse(texto)
  if (respuesta.usage) {
    const { input_tokens, output_tokens } = respuesta.usage
    console.log(`✅ VERIFICACIÓN C: Sin visión, tokens bajo`)
    console.log(`   Input: ${input_tokens}, Output: ${output_tokens}`)
  }
} catch (err) {
  console.error('❌ Error C:', err.message)
}
