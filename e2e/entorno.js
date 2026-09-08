import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Vuelca las claves de un fichero .env en process.env sin pisar lo existente. */
function cargarEnv(fichero) {
  let contenido
  try {
    contenido = readFileSync(resolve(RAIZ, fichero), 'utf8')
  } catch {
    return
  }
  for (const linea of contenido.split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    const valor = m[2].replace(/^["']|["']$/g, '')
    if (!process.env[m[1]]) process.env[m[1]] = valor
  }
}

// Igual que scripts/db-setup.mjs: .env.local (de `vercel env pull`) tiene
// prioridad sobre .env.
cargarEnv('.env.local')
cargarEnv('.env')

/** Lee una variable obligatoria, fallando pronto y con un mensaje útil. */
export function exigir(clave) {
  const valor = process.env[clave]
  if (!valor) throw new Error(`Falta ${clave} en .env o .env.local; los tests e2e la necesitan.`)
  return valor
}

export const PUERTO = 5199
export const BASE_URL = `http://localhost:${PUERTO}`

/**
 * Abre el candado del portal vecinal para poder visitar las páginas públicas.
 * La contraseña se verifica en el servidor (POST /api/acceso) y la cookie de
 * portal resultante queda en el contexto del navegador, así que los `goto`
 * posteriores la envían. Reemplaza al antiguo localStorage 'ncv_access'.
 */
export async function abrirCandado(page) {
  const password = exigir('APP_ACCESO_PASSWORD')
  const res = await page.request.post('/api/acceso', { data: { password } })
  if (!res.ok()) {
    throw new Error(`No se pudo abrir el candado del portal (HTTP ${res.status()}).`)
  }
}

/** Vercel Blob sirve los ficheros desde este dominio. */
export const DOMINIO_BLOB = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//

// ── Sesiones reutilizadas entre tests (storageState) ──────────────────────
//
// Los dos logins están limitados a 5 intentos por 15 minutos y por IP (ver
// api/login.js y api/admin/login.js). Una pasada completa hacía más de 40
// logins —cada spec tenía su propio helper y admin-super lo llamaba en un
// beforeEach, por cada test y por cada viewport—, así que a partir del quinto
// todo caía con "Demasiadas peticiones" y la suite dejaba de decir nada.
//
// Ahora el proyecto `setup` inicia sesión UNA vez por tier y guarda la cookie
// en estos ficheros; los specs la reciben con `test.use({ storageState })`.
// Como la sesión dura 8 h (DURACION_SESION_S en api/_auth.js), un fichero
// reciente se reutiliza también ENTRE pasadas: repetir la suite no gasta
// ningún login.
export const DIR_SESIONES = resolve(RAIZ, 'e2e/.sesiones')
export const SESION_SUPER = resolve(DIR_SESIONES, 'superadmin.json')
export const SESION_ORG = resolve(DIR_SESIONES, 'organizacion.json')

// Sin sesión, explícito: para el test que comprueba que /admin muestra el
// login. Sin esto heredaría la cookie del proyecto y no probaría nada.
export const SIN_SESION = { cookies: [], origins: [] }
