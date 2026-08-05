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
  'SUPER_ADMIN_EMAIL',
  'SUPER_ADMIN_PASSWORD',
  'SUPER_ADMIN_NOMBRE',
  'BLOB_READ_WRITE_TOKEN',
  'BLOB_STORE_ID',
  'VERCEL_OIDC_TOKEN',
  'UMAMI_API_URL',
  'UMAMI_USERNAME',
  'UMAMI_PASSWORD',
  'UMAMI_WEBSITE_ID',
  // Candado del portal verificado en servidor (api/acceso.js).
  'APP_ACCESO_PASSWORD',
  // Desactivación del asistente (api/chat.js): por defecto está apagado (julio 2026).
  'ASISTENTE_ACTIVO',
  // Auth del cron de sincronización de eventos (api/sync-events.js).
  'CRON_SECRET',
  // Rate-limiting compartido (api/_ratelimit.js). La integración de Upstash
  // puede inyectar cualquiera de los dos juegos de nombres; aceptamos ambos.
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  // Notificaciones push (api/_push-send.js, vía api/sync-events.js). La clave
  // pública lleva prefijo VITE_ porque el navegador la necesita para
  // suscribirse; el servidor también la lee de process.env. La privada, jamás.
  'VITE_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  // reCAPTCHA v3 (api/sugerencias.js, api/solicitar-reclamacion.js).
  // La clave pública la usa el navegador para obtener el token (prefijo VITE_);
  // la secreta solo el servidor para verificarlo.
  'VITE_RECAPTCHA_SITE_KEY',
  'RECAPTCHA_SECRET_KEY',
  // Webhook de sincronización de Instagram (api/sync-instagram.js): secreto de
  // autenticación del webhook de Apify y token para leer sus datasets.
  'INSTAGRAM_SYNC_SECRET',
  'APIFY_TOKEN',
  // Webhook de noticias de Instagram (api/sync-instagram-noticias.js): secreto
  // propio para poder rotarlo sin tocar el de eventos.
  'NOTICIAS_SYNC_SECRET',
  // Commits a GitHub desde el panel superadmin de comercios
  // (api/super/comercios.js) y el cron de eventos (api/sync-events.js).
  'GITHUB_TOKEN',
  'GITHUB_REPO',
  // Email (api/super/reclamaciones.js): enviar correos con código de invitación
  'RESEND_API_KEY',
  'VITE_APP_URL',
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

        // Cuerpo crudo (Vite no lo lee por nosotros).
        const chunks = []
        for await (const c of req) chunks.push(c)
        const raw = chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : ''

        try {
          const mod = await server.ssrLoadModule(modulo)

          // Las Edge Functions (config.runtime === 'edge') reciben una Request
          // de la Web API y devuelven una Response — igual que en Vercel. Si el
          // handler usara (req, res) de Node aquí fallaría, exactamente como
          // fallaría desplegado: el dev server no debe enmascarar la diferencia.
          if (mod.config?.runtime === 'edge') {
            const url = `http://${req.headers.host ?? 'localhost'}${req.url}`
            const cabeceras = new Headers()
            for (const [clave, valor] of Object.entries(req.headers)) {
              if (typeof valor === 'string') cabeceras.set(clave, valor)
              else if (Array.isArray(valor)) cabeceras.set(clave, valor.join(', '))
            }
            const peticion = new Request(url, {
              method: req.method,
              headers: cabeceras,
              body: req.method === 'GET' || req.method === 'HEAD' ? undefined : raw,
            })

            const respuesta = await mod.default(peticion)

            res.statusCode = respuesta.status
            respuesta.headers.forEach((valor, clave) => {
              if (clave !== 'set-cookie') res.setHeader(clave, valor)
            })
            // Set-Cookie puede venir repetida; Headers la aplana salvo con getSetCookie.
            const cookies = respuesta.headers.getSetCookie?.() ?? []
            if (cookies.length > 0) res.setHeader('Set-Cookie', cookies)
            res.end(Buffer.from(await respuesta.arrayBuffer()))
            return
          }

          // Funciones Serverless (Node): adaptadores estilo Express/Vercel.
          try {
            req.body = raw ? JSON.parse(raw) : {}
          } catch {
            req.body = {}
          }
          req.query = Object.fromEntries(new URLSearchParams(queryString))
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (obj) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
          }
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
