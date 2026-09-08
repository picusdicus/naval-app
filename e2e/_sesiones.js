import { existsSync, mkdirSync } from 'node:fs'
import { BASE_URL, DIR_SESIONES } from './entorno.js'

// Piezas comunes a los dos ficheros de setup (uno por tier). Van aparte para
// que cada tier sea un proyecto independiente de Playwright: si las
// credenciales de la organización dejan de valer, sus specs fallan pero los
// del superadmin siguen ejecutándose. Con un único setup para ambos, un tier
// roto dejaba la suite entera sin correr.

/**
 * ¿Sirve todavía la sesión guardada? Se pregunta al servidor en vez de mirar
 * la fecha del fichero: la cookie dura 8 h (DURACION_SESION_S en _auth.js),
 * pero rotar ADMIN_JWT_SECRET la invalida antes de tiempo, y entonces todos
 * los tests de ese tier fallarían con errores confusos en vez de con un login
 * limpio. Una petición barata lo descarta.
 *
 * @param {'superadmin'|'organizacion'} tier
 */
export async function sesionValida(playwright, fichero, tier) {
  if (!existsSync(fichero)) return false
  const contexto = await playwright.request.newContext({
    baseURL: BASE_URL,
    storageState: fichero,
  })
  try {
    const res = await contexto.get('/api/admin/sesion')
    if (!res.ok()) return false
    const { usuario } = await res.json().catch(() => ({}))
    // El rol distingue los dos tiers: reutilizar la cookie de la organización
    // para el superadmin daría 401 en cada endpoint de /api/super.
    return tier === 'superadmin'
      ? usuario?.rol === 'superadmin'
      : Boolean(usuario) && usuario.rol !== 'superadmin'
  } catch {
    return false
  } finally {
    await contexto.dispose()
  }
}

export function prepararDirectorio() {
  mkdirSync(DIR_SESIONES, { recursive: true })
}
