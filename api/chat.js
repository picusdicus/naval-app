import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from './_knowledge.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

// Simple in-memory rate limiter (resets on server restart).
// In Vercel each instance has its own Map, but it's enough to prevent basic abuse.
const requestCountByIP = new Map()
const REQUESTS_PER_MINUTE_LIMIT = 10

function isWithinRateLimit(ip) {
  const now = Date.now()
  const entry = requestCountByIP.get(ip) || { count: 0, since: now }

  // Reset counter if more than one minute has passed.
  if (now - entry.since > 60_000) {
    requestCountByIP.set(ip, { count: 1, since: now })
    return true
  }

  // Reject if limit exceeded.
  if (entry.count >= REQUESTS_PER_MINUTE_LIMIT) return false

  entry.count++
  requestCountByIP.set(ip, entry)
  return true
}

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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en el servidor.' })
    return
  }

  // Get client IP (Vercel sets this header).
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'

  // Check rate limit before making any call to Anthropic.
  if (!isWithinRateLimit(clientIP)) {
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
    if (res.headersSent && !res.writableEnded) {
      res.write('\n\n[Se produjo un error al generar la respuesta.]')
      res.end()
    } else {
      res.status(500).json({ error: 'Error al generar la respuesta.', detalle: err.message })
    }
  }
}