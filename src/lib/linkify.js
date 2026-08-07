// Divide un texto en fragmentos de texto plano y URLs, para poder renderizar
// las URLs como enlaces clicables. Solo captura http(s):// explícito (nunca
// javascript: ni otros esquemas), así que el resultado es seguro de usar
// directamente como href sin validación adicional.
const PATRON_URL = /(https?:\/\/[^\s<>"']+)/g

// Puntuación de cierre de frase que queda pegada al final de una URL en
// texto natural ("...consulta aquí: https://x.es/y.") y no forma parte del
// enlace real.
const PUNTUACION_FINAL = /[.,;:!?)\]}»"']+$/

/** [{url: false, valor: 'texto'} | {url: true, valor: 'https://...'}] */
export function partesConEnlaces(texto) {
  const cadena = String(texto || '')
  if (!cadena) return []

  const partes = []
  let ultimo = 0
  for (const m of cadena.matchAll(PATRON_URL)) {
    const inicio = m.index
    if (inicio > ultimo) partes.push({ url: false, valor: cadena.slice(ultimo, inicio) })

    let enlace = m[0]
    const recorte = enlace.match(PUNTUACION_FINAL)
    const resto = recorte ? recorte[0] : ''
    if (resto) enlace = enlace.slice(0, -resto.length)

    if (enlace) partes.push({ url: true, valor: enlace })
    if (resto) partes.push({ url: false, valor: resto })
    ultimo = inicio + m[0].length
  }
  if (ultimo < cadena.length) partes.push({ url: false, valor: cadena.slice(ultimo) })
  return partes
}
