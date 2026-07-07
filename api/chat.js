import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from './_knowledge.js'

// Modelo por defecto: Opus 4.8. Configurable con la variable de entorno
// ANTHROPIC_MODEL (p. ej. "claude-haiku-4-5" para reducir coste).
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

// Normaliza el historial recibido del frontend a mensajes válidos de la API:
// roles user/assistant, empezando por user y sin entradas vacías.
function prepararMensajes(entrada) {
  if (!Array.isArray(entrada)) return []
  const mensajes = entrada
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.trim(),
    }))
  // La API exige que el primer mensaje sea del usuario.
  while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift()
  return mensajes
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en el servidor.' })
    return
  }

  const mensajes = prepararMensajes(req.body?.messages)
  if (!mensajes.length) {
    res.status(400).json({ error: 'No hay ningún mensaje del usuario.' })
    return
  }

  const client = new Anthropic()

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: mensajes,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(event.delta.text)
      }
    }
    res.end()
  } catch (err) {
    // Si ya empezamos a enviar el cuerpo, solo podemos cerrar.
    if (res.headersSent && res.writableEnded === false) {
      res.write('\n\n[Se produjo un error al generar la respuesta.]')
      res.end()
    } else {
      res.status(500).json({ error: 'Error al generar la respuesta.', detalle: err.message })
    }
  }
}
