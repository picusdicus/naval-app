// Imagen ilustrativa para los eventos sin cartel propio.
//
// Las ilustrativas salen EXCLUSIVAMENTE de las que el superadmin sube desde
// /admin → "Imágenes genéricas" (tabla `imagenes_evento_genericas`, ficheros
// en Blob bajo eventos-genericas/<categoria>/<disciplina>). No hay pool en el
// código: el que había (33 fotos de Wikimedia Commons por categoría, rama de
// la issue #23) se retiró en sep-2026 al decidirse que solo se muestren las
// subidas a mano — una categoría sin fotos subidas cae al degradado de
// categoría de siempre hasta que se suba alguna.
//
// Quién filtra qué: este módulo NO sabe de categorías ni disciplinas. Recibe
// en `genericas` la lista YA filtrada para el evento (misma categoría y, si el
// título deja reconocer la disciplina, misma disciplina; si no, solo las
// genéricas sin disciplina) — el filtro vive en useImagenEvento y en los dos
// carruseles (Inicio/Eventos) que llaman a eventoATarjeta.
//
// Módulo "limpio" (sin React): lo importa también destacados.js.

import { destinoImagenEvento } from './eventos.js'

// Interruptor de seguridad: a false, imagenEvento() nunca devuelve una
// ilustrativa aunque existan en Neon — cae en "sin imagen" (degradado +
// icono). Las fotos propias de los eventos (posterUrl real) no dependen de él.
const MOSTRAR_IMAGENES_GENERICAS = true

// Hash determinista y barato (djb2) para que cada evento elija SIEMPRE la
// misma variante entre recargas y dispositivos — nunca aleatoria por render.
function hashDe(texto) {
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0
  return h
}

/**
 * Genéricas que le corresponden a un evento: las de su categoría de imagen y
 * su subtipo (misma categoría y subtipo exactos), o las que no tienen subtipo
 * si el evento no lo tiene. Nunca las de OTRO subtipo: un torneo de tenis no
 * debe salir con una carrera popular, ni una novena con fuegos artificiales.
 *
 * Único sitio donde se decide qué imágenes ve un evento: lo usan el hook
 * useImagenEvento y los carruseles de Inicio y Eventos.
 */
export function genericasParaEvento(evento, genericas = []) {
  if (!evento || !genericas || genericas.length === 0) return []
  const { categoria, subtipo } = destinoImagenEvento(evento)
  return genericas.filter((g) => {
    if (g.categoria !== categoria) return false
    return subtipo === null ? g.disciplina === null : g.disciplina === subtipo
  })
}

/** Atribución de una genérica: "autor, licencia" si los hay; si no, la fuente. */
export function creditoDe(g) {
  const partes = [g.autor, g.licencia].filter((x) => x && String(x).trim())
  if (partes.length > 0) return partes.join(', ')
  return g.fuente && String(g.fuente).trim() ? g.fuente : ''
}

/** Créditos únicos de un conjunto de genéricas (pie de la página de eventos). */
export function creditosDe(genericas = []) {
  return [...new Set(genericas.map(creditoDe).filter(Boolean))]
}

/**
 * Elige la imagen de un evento.
 *  - Con foto propia (campo `imagen`, p. ej. el cartel real): {src, real: true}.
 *    Gana siempre: una publicación con cartel sustituye a la ilustrativa.
 *  - Sin ella y con `genericas` (ya filtradas para este evento): una de ellas,
 *    estable por id del evento → {src, credito, real: false}.
 *  - Sin ninguna de las dos: null (degradado de categoría).
 *  - `paraHeroe` se acepta por compatibilidad con los llamadores; hoy no
 *    excluye nada (las subidas no llevan marca de resolución).
 */
export function imagenEvento(evento, { genericas = [] } = {}) {
  if (evento.imagen && evento.imagen.trim()) return { src: evento.imagen, real: true }
  if (!MOSTRAR_IMAGENES_GENERICAS) return null
  if (!genericas || genericas.length === 0) return null

  const semilla = hashDe(String(evento.id ?? evento.titulo ?? ''))
  const elegida = genericas[semilla % genericas.length]
  if (!elegida?.url) return null
  return { src: elegida.url, credito: creditoDe(elegida), real: false }
}
