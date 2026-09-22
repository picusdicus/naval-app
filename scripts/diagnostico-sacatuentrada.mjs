// Diagnóstico en MODO LECTURA de la taquilla del Teatro Municipal Centro:
// descarga la portada real, lee las filas candidatas del Neon real y muestra
// obra a obra con qué fila empareja y por qué nivel, más qué escribiría el
// cron (cartel sustituible, entradas a rellenar, borradores nuevos). No
// escribe en Neon ni en Blob y no llama a las páginas de detalle/entradas.
//
//   node scripts/diagnostico-sacatuentrada.mjs            # portada en vivo
//   node scripts/diagnostico-sacatuentrada.mjs --fixture  # portada guardada del 2026-09-22
//   node scripts/diagnostico-sacatuentrada.mjs --cdn      # además comprueba que el CDN sirve cada cartel
import fs from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { obtenerPortadaSacatuentrada, parsearPortada, emparejarObrasConFilas, idDeObra } from '../api/_sacatuentrada-feed.js'
import { leerFilasCandidatas, imagenSustituible } from '../api/_sacatuentrada-revision.js'

for (const f of ['.env.local', '.env']) {
  if (!fs.existsSync(f)) continue
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
const args = new Set(process.argv.slice(2))

const obras = args.has('--fixture')
  ? parsearPortada(fs.readFileSync('tests/fixtures/sacatuentrada/portada-2026-09-22.html', 'utf8'))
  : await obtenerPortadaSacatuentrada()
console.log(`Obras en portada: ${obras.length}`)

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL)
const filas = await leerFilasCandidatas(sql, obras)
console.log(`Filas de eventos_usuario en esas fechas: ${filas.length}\n`)

const { emparejadas, sinPareja } = emparejarObrasConFilas(obras, filas)
for (const { obra, fila, nivel } of emparejadas) {
  const cambios = []
  if (obra.urlsCartel.length && imagenSustituible(fila)) cambios.push('cartel → sustituir')
  if (!fila.entradas_url && obra.urlCompra) cambios.push('entradas → rellenar')
  console.log(`✔ ${obra.fecha}  ${obra.rotulo}`)
  console.log(`     ↔ [${nivel}] ${fila.titulo}  (${fila.estado}, ${fila.origen_externo_id || 'a mano'})`)
  console.log(`     escribiría: ${cambios.length ? cambios.join(', ') : 'nada (sin cambios)'}`)
}
for (const obra of sinPareja) {
  console.log(`✚ ${obra.fecha}  ${obra.rotulo}  → borrador nuevo ${idDeObra(obra)}`)
}
const noUsadas = filas.filter((f) => !emparejadas.some((e) => e.fila.id === f.id))
if (noUsadas.length) {
  console.log('\nFilas de esas fechas que NO se tocan:')
  noUsadas.forEach((f) => console.log(`   · ${f.fecha}  ${f.titulo}  (${f.lugar}, ${f.estado})`))
}

if (args.has('--cdn')) {
  console.log('\nCDN de carteles:')
  for (const o of obras) {
    for (const u of o.urlsCartel) {
      const res = await fetch(u, { signal: AbortSignal.timeout(15000) }).catch((e) => ({ status: e.message }))
      console.log(`   ${res.status} ${res.headers?.get?.('content-type') || ''}  ${u.replace(/.*\/tiendas\//, '')}`)
      if (res.ok) break
    }
  }
}
