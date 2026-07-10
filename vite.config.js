import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Variables que los handlers de api/ leen de process.env y que Vite solo
// expone en import.meta.env. Las copiamos para que funcionen con `npm run dev`.
const VARIABLES_API = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'DATABASE_URL',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'ADMIN_JWT_SECRET',
  'ADMIN_NOMBRE',
  'ADMIN_ORG_SLUG',
  'BLOB_READ_WRITE_TOKEN',
]

// Un segmento por carpeta, solo letras/números/guiones: ni traversal (`..`) ni
// ficheros privados (los que empiezan por `_`, que Vercel tampoco despliega).
const RUTA_API = /^\/api\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)$/

// Middleware de desarrollo: sirve las funciones de api/ con `npm run dev`,
// usando los mismos handlers que se despliegan en Vercel. Así se pueden probar
// el asistente y el panel /admin en local sin desplegar en producción.
function devApiPlugin(env) {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      // Hace visibles las variables del .env a los handlers (que leen process.env).
      for (const clave of VARIABLES_API) {
        if (env[clave]) process.env[clave] = env[clave]
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next()

        const [rutaUrl, queryString = ''] = req.url.split('?')
        const coincidencia = RUTA_API.exec(rutaUrl)
        if (!coincidencia) return next()

        const modulo = `/api/${coincidencia[1]}.js`
        if (!existsSync(resolve(process.cwd(), `.${modulo}`))) return next()

        // Parseo del cuerpo JSON (Vite no lo hace por nosotros).
        const chunks = []
        for await (const c of req) chunks.push(c)
        const raw = Buffer.concat(chunks).toString('utf8')
        try {
          req.body = raw ? JSON.parse(raw) : {}
        } catch {
          req.body = {}
        }

        req.query = Object.fromEntries(new URLSearchParams(queryString))

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
          const mod = await server.ssrLoadModule(modulo)
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
