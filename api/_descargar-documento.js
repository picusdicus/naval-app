// Descarga de documentos enlazados (PDF o HTML) desde la web municipal.
//
// Vivía dentro de api/sync-instagram-noticias.js como funciones privadas; se
// extrajo aquí SIN cambios de comportamiento cuando la importación de talleres
// por PDF necesitó lo mismo. Los dos sitios que lo usan son el webhook de
// noticias (sigue el enlace del caption) y api/super/talleres-importar.js
// (importa el folleto de horarios por URL).
//
// Solo Node: usa Buffer.
//
// El guion bajo evita que Vercel lo despliegue como endpoint propio.

// Un PDF de agenda trimestral ronda 2-5 MB; 15 MB da margen sin acercarse al
// límite de la API de Anthropic (~32 MB de petición).
export const MAX_PDF_BYTES = 15 * 1024 * 1024

const MAX_HTML_BYTES = 300_000 // 300 KB: páginas municipales largas (39+ actividades)

/**
 * ¿La URL apunta a la web municipal? Allowlist a propósito: quien pide la
 * descarga puede ser un tercero (el caption de un post de Instagram), y este
 * código descarga y manda a un modelo lo que encuentre — solo se sigue a
 * navalcarnero.es.
 */
export function esUrlMunicipal(cruda) {
  try {
    const u = new URL(String(cruda ?? '').replace(/[),.;]+$/, ''))
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.hostname === 'navalcarnero.es' || u.hostname.endsWith('.navalcarnero.es')) {
      return u.href
    }
  } catch {
    // URL malformada: se ignora.
  }
  return null
}

/** Primera URL de un texto que apunte a la web municipal, o null. */
export function detectarUrl(caption) {
  if (!caption) return null
  for (const cruda of caption.match(/https?:\/\/[^\s]+/g) || []) {
    const href = esUrlMunicipal(cruda)
    if (href) return href
  }
  return null
}

/**
 * Descarga HTML o PDF desde una URL. Para HTML, extrae el contenido principal
 * del artículo y descarta cabecera, menú, sidebar para maximizar el contenido útil
 * antes de aplicar el límite de tamaño (evita truncamiento de galerias al final).
 *
 * Devuelve {tipo: 'pdf', buffer} o {tipo: 'html', html}. Lanza si falla.
 */
export async function descargarDocumento(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'NavalcarneroCrawler/1.0' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim()
    if (contentType === 'application/pdf' || /\.pdf(?:[?#]|$)/i.test(url)) {
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length === 0 || buffer.length > MAX_PDF_BYTES) {
        throw new Error(`PDF fuera de límite (${buffer.length} bytes)`)
      }
      return { tipo: 'pdf', buffer }
    }

    let html = await response.text()
    const htmlOriginalSize = html.length

    // Recortar por contenido: extraer solo el artículo principal (WordPress)
    // y descartar cabecera, menú, sidebar para maximizar contenido útil.
    // Los selectores son específicos del WordPress de Navalcarnero (art-postcontent o entrada).
    const match = html.match(/<div[^>]*class="[^"]*(?:entrada|art-postcontent)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)
    if (match && match[1].length > 1000) {
      // Si el contenido extraído es significativo, úsalo (descarta chrome de la página)
      html = match[1]
      console.log(`[descargarDocumento] Contenido extraído: ${htmlOriginalSize} → ${html.length} bytes`)
    }

    // Aplicar límite de tamaño DESPUÉS del recorte por contenido
    if (html.length > MAX_HTML_BYTES) {
      console.warn(
        `[descargarDocumento] HTML truncado: ${html.length} → ${MAX_HTML_BYTES} bytes (límite) de ${url}`
      )
      html = html.substring(0, MAX_HTML_BYTES)
    }

    return { tipo: 'html', html }
  } catch (err) {
    throw new Error(`Error al descargar ${url}: ${err.message}`)
  }
}
