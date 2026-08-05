import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from './_knowledge.js'
import { limitar, obtenerIp } from './_ratelimit.js'
import { csrfInvalido } from './_http.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

// Normalizes the history received from the frontend into valid API messages:
// user/assistant roles, starting with user and without empty entries.
// Limited to the last 10 messages to control cost per call.
function prepareMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return []
  const MAX_MESSAGES = 10 // last 5 turns (user + assistant)
  const messages = rawMessages
    .slice(-MAX_MESSAGES)
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.trim(),
    }))
  // The API requires the first message to be from the user.
  while (messages.length && messages[0].role !== 'user') messages.shift()
  return messages
}

export default async function handler(req, res) {
  // Guard de desactivación del asistente (julio 2026).
  // Devuelve 404 para que el endpoint no anuncie su existencia, aunque está
  // expuesto a internet. Para reactivar: ASISTENTE_ACTIVO=1 en las env de Vercel.
  // Sin cambios de código.
  if (process.env.ASISTENTE_ACTIVO !== '1') {
    res.status(404).json({ error: 'Not Found' })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }

  if (csrfInvalido(req)) {
    res.status(403).json({ error: 'Origen no permitido.' })
    return
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en el servidor.' })
    return
  }

  // Rate limit compartido (Upstash) antes de llamar a Anthropic: el límite en
  // memoria anterior no servía en serverless (un Map por instancia).
  const limite = await limitar({ clave: `chat:ip:${obtenerIp(req)}`, limite: 10, ventanaS: 60 })
  if (!limite.ok) {
    res.setHeader('Retry-After', String(limite.resetEnS))
    res.status(429).json({
      error: 'Demasiadas peticiones. Espera un momento antes de volver a preguntar.',
    })
    return
  }

  const messages = prepareMessages(req.body?.messages)
  if (!messages.length) {
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
      // System prompt marked for prompt caching: Anthropic caches it for ~5
      // minutes, reducing cost by ~90% on repeated calls.
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(event.delta.text)
      }
    }
    res.end()
  } catch (err) {
    console.error('Error en /api/chat:', err)
    if (res.headersSent && !res.writableEnded) {
      res.write('\n\n[Se produjo un error al generar la respuesta.]')
      res.end()
    } else {
      // Sin `detalle`: no filtramos internals (modelo, cuotas, trazas del SDK).
      res.status(500).json({ error: 'Error al generar la respuesta.' })
    }
  }
}