import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Middleware de desarrollo: sirve la función /api/chat con `npm run dev`,
// usando el mismo handler que se despliega en Vercel (api/chat.js).
// Así se puede probar el asistente en local sin desplegar en producción.
function devApiPlugin(env) {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      // Hace visibles las variables del .env al handler (que lee process.env).
      if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
      if (env.ANTHROPIC_MODEL) process.env.ANTHROPIC_MODEL = env.ANTHROPIC_MODEL

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/chat')) return next()

        // Parseo del cuerpo JSON (Vite no lo hace por nosotros).
        const chunks = []
        for await (const c of req) chunks.push(c)
        const raw = Buffer.concat(chunks).toString('utf8')
        try {
          req.body = raw ? JSON.parse(raw) : {}
        } catch {
          req.body = {}
        }

        // Adaptadores estilo Express/Vercel sobre la respuesta Node cruda.
        res.status = (code) => {
          res.statusCode = code
          return res
        }
        res.json = (obj) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
        }

        try {
          const mod = await server.ssrLoadModule('/api/chat.js')
          await mod.default(req, res)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devApiPlugin(env)],
  }
})
