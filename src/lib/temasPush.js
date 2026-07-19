// Temas de las notificaciones push (fase 1 de NOTIFICACIONES_PUSH.md).
//
// Un tema es una cadena plana: 'todos', 'cat:<categoria>' u 'org:<slug>'.
// Una suscripción recibe un evento si sus temas intersecan con los del evento
// (o contiene 'todos').
//
// Módulo "limpio" a propósito (sin JSX ni JSON): lo importan los handlers de
// api/ (Edge y Node) además del navegador, igual que tarifasDestacados.js.

import { CATEGORIAS_EVENTO } from './eventos.js'

/**
 * Mapeo fuente-externa → slug de organización. El TYL TYL tiene doble
 * identidad: sus eventos llegan por su API de WordPress (`fuente: 'TYL TYL'`)
 * y por su panel como organización de Neon (slug `tyl-tyl`); el tema
 * `org:tyl-tyl` debe cubrir ambos caminos o el suscriptor se pierde la mitad
 * de la programación del teatro.
 */
export const ORG_POR_FUENTE = {
  'TYL TYL': 'tyl-tyl',
  Ayuntamiento: 'ayuntamiento',
}

/**
 * Organizadores fijos del selector de la UI. La lista visible es semi-fija
 * (estos + las organizaciones activas de Neon), NO derivada de qué fuentes
 * tienen eventos en el JSON en ese momento: el TYL TYL para en verano y
 * desaparecería del selector.
 */
export const ORGANIZADORES_FIJOS = [
  { slug: 'ayuntamiento', nombre: 'Ayuntamiento de Navalcarnero' },
  { slug: 'tyl-tyl', nombre: 'Teatro TYL TYL' },
]

const RE_SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/

/** ¿Es un tema válido de la lista blanca ('todos' | 'cat:…' | 'org:…')? */
export function temaValido(tema) {
  if (typeof tema !== 'string') return false
  if (tema === 'todos') return true
  if (tema.startsWith('cat:')) return Boolean(CATEGORIAS_EVENTO[tema.slice(4)])
  if (tema.startsWith('org:')) return RE_SLUG.test(tema.slice(4))
  return false
}

/**
 * Valida una lista de temas de suscripción. Devuelve la lista normalizada
 * (sin duplicados) o null si está vacía, no es lista o algún tema no pasa la
 * lista blanca.
 */
export function validarTemas(temas) {
  if (!Array.isArray(temas) || temas.length === 0 || temas.length > 30) return null
  const unicos = [...new Set(temas)]
  return unicos.every(temaValido) ? unicos : null
}

/**
 * Temas de un evento: 'cat:<categoria>' + 'org:<slug>' cuando el organizador
 * es atribuible. Resolución del organizador, por orden:
 *   1. `evento.organizacionSlug` — eventos de Neon (el cron lo trae del JOIN
 *      con organizaciones).
 *   2. `evento.fuente` vía ORG_POR_FUENTE — eventos externos sincronizados
 *      ('TYL TYL', 'Ayuntamiento').
 *   3. `origen: 'municipal'` — eventos curados del Ayuntamiento en
 *      eventos.json (no llevan `fuente`).
 */
export function temasDeEvento(evento) {
  const temas = []
  if (evento.categoria && CATEGORIAS_EVENTO[evento.categoria]) {
    temas.push(`cat:${evento.categoria}`)
  }
  const slug =
    evento.organizacionSlug ||
    ORG_POR_FUENTE[evento.fuente] ||
    (evento.origen === 'municipal' ? 'ayuntamiento' : null)
  if (slug && RE_SLUG.test(slug)) temas.push(`org:${slug}`)
  return temas
}

/** ¿La suscripción quiere este evento? ('todos' o intersección de temas). */
export function interseca(temasSuscripcion, temasEvento) {
  if (!Array.isArray(temasSuscripcion)) return false
  if (temasSuscripcion.includes('todos')) return true
  return temasEvento.some((t) => temasSuscripcion.includes(t))
}
