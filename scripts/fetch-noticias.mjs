// Genera src/data/noticias.json descargando el RSS de prensa del Ayuntamiento.
// La lógica de descarga/parseo vive en api/_noticias-feed.js (compartida con el
// cron api/sync-events.js, que la mantiene fresca a diario). Este script solo
// la vuelca a disco para la regeneración manual.
//
// Uso: npm run fetch:noticias

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { obtenerNoticiasPrensa } from '../api/_noticias-feed.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(__dirname, '../src/data/noticias.json')

async function main() {
  try {
    console.log('Descargando RSS de Prensa del Ayuntamiento...')
    const noticias = await obtenerNoticiasPrensa()
    mkdirSync(dirname(SALIDA), { recursive: true })
    writeFileSync(SALIDA, JSON.stringify(noticias, null, 2) + '\n', 'utf8')
    console.log(`✓ Guardadas ${noticias.length} noticias en ${SALIDA}`)
  } catch (err) {
    console.error('✗ Error:', err.message)
    process.exit(1)
  }
}

main()
