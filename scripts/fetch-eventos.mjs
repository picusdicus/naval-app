// Importa eventos del Teatro TYL TYL (Navalcarnero) desde su API pública
// (plugin The Events Calendar) y los escribe en src/data/eventos-externos.json.
//
// Uso: npm run fetch:eventos
//
// No toca src/data/eventos.json (eventos curados a mano). La app y el asistente
// combinan ambas fuentes.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(__dirname, '../src/data/eventos-externos.json')

const API = 'https://www.tyltyl.org/wp-json/tribe/events/v1/events'

// Limpia HTML: entidades comunes + etiquetas, y recorta a una longitud máxima.
function limpiarTexto(html, max = 220) {
  if (!html) return ''
  const txt = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#8220;|&#8221;|&laquo;|&raquo;/g, '"')
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return txt.length > max ? txt.slice(0, max - 1).trimEnd() + '…' : txt
}

// "2026-09-15 18:00:00" -> { fecha: "2026-09-15", hora: "18:00" }
function partesFecha(startDate, allDay) {
  const [fecha, hora] = String(startDate || '').split(' ')
  return { fecha: fecha || '', hora: allDay ? '' : (hora ? hora.slice(0, 5) : '') }
}

async function traerPagina(page) {
  const url = `${API}?per_page=50&page=${page}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NavalcarneroApp/0.1 (proyecto vecinal)' },
  })
  if (!res.ok) throw new Error(`TYL TYL API respondió ${res.status}`)
  return res.json()
}

async function main() {
  console.log('Consultando la agenda de TYL TYL…')
  const eventos = []
  let page = 1
  let totalPaginas = 1

  do {
    const data = await traerPagina(page)
    totalPaginas = data.total_pages || 1
    for (const ev of data.events || []) {
      const { fecha, hora } = partesFecha(ev.start_date, ev.all_day)
      if (!fecha) continue
      const lugar = ev.venue && ev.venue.venue ? limpiarTexto(ev.venue.venue, 80) : 'Teatro TYL TYL'
      eventos.push({
        id: `tyltyl-${ev.id}`,
        titulo: limpiarTexto(ev.title, 120),
        fecha,
        hora,
        lugar,
        categoria: 'cultura',
        origen: 'cultural',
        descripcion: limpiarTexto(ev.excerpt || ev.description, 220),
        url: ev.url || '',
        fuente: 'TYL TYL',
      })
    }
    page += 1
  } while (page <= totalPaginas)

  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''))

  mkdirSync(dirname(SALIDA), { recursive: true })
  writeFileSync(SALIDA, JSON.stringify(eventos, null, 2) + '\n', 'utf8')
  console.log(`Guardados ${eventos.length} eventos de TYL TYL en ${SALIDA}`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
