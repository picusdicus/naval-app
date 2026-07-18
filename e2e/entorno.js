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
