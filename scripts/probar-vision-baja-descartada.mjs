#!/usr/bin/env node
// Ejercita las tres ramas de confianza de la fecha por visión del feed de
// deportes SIN gastar llamadas a la API: inyecta un extractor falso vía el
// parámetro `extraerFechas` de obtenerActividadesDeportivas() (solo para
// tests/diagnóstico). Usa carteles huérfanos REALES de la galería en vivo.
//
// Ramas cubiertas:
//   1. baja + huérfano  → la fecha se DESCARTA (fecha_evento null, invisible,
//      idéntico byte a byte al estado sin visión) — la rama que ningún run
//      real ha ejercitado todavía.
//   2. baja + empareja  → la fecha se usa (el programa la valida).
//   3. alta + huérfano  → la fecha se usa siempre.
//
// No escribe en ingesta_log (borra DATABASE_URL) ni llama a Anthropic (borra
// ANTHROPIC_API_KEY y además el extractor real nunca se invoca).
import assert from 'node:assert/strict'
import { obtenerActividadesDeportivas } from '../api/_actividades-deportes-feed.js'
import programaFiestas from '../api/_datos/programa-fiestas-2026.js'

delete process.env.ANTHROPIC_API_KEY
delete process.env.DATABASE_URL

const busca = (r, regex) =>
  [...r.actividades, ...r.paraRevision].find((a) => regex.test(a.titulo) && !a.reconstruido_desde_plazo)

// ——— Referencia: run sin visión (todo null) = estado de main hoy ———
const extractorNulo = (urls) => urls.map(() => ({ fecha: null, confianza: 'baja' }))
const base = await obtenerActividadesDeportivas(programaFiestas, { extraerFechas: extractorNulo })

// Huérfano real que NO empareja con el programa (verificado en la rama: es
// uno de los 5 grandfathered sin emparejar) y cartel real que SÍ empareja
// cuando lleva su fecha verdadera.
const huerfano = busca(base, /cicloturism/i)
const emparejable = busca(base, /carrera del galgos/i)
assert.ok(huerfano, 'no se encontró el cartel huérfano "marcha cicloturisma" en la galería')
assert.ok(emparejable, 'no se encontró el cartel "Carrera del galgos" en la galería')
assert.equal(huerfano.fecha_evento, null, 'el huérfano debería salir sin fecha en el run base')

// ——— Caso 1: baja + huérfano → descartada ———
const FECHA_FALSA = '2026-09-05'
const soloObjetivo = (fecha, confianza, imagenObjetivo) => (urls) =>
  urls.map((u) => (u === imagenObjetivo ? { fecha, confianza } : { fecha: null, confianza: 'baja' }))

const r1 = await obtenerActividadesDeportivas(programaFiestas, {
  extraerFechas: soloObjetivo(FECHA_FALSA, 'baja', huerfano.imagen),
})
const emitido1 = [...r1.actividades, ...r1.paraRevision].find(
  (a) => a.origen_externo_id === huerfano.origen_externo_id
)
assert.ok(emitido1, 'el huérfano debe seguir emitiéndose')
assert.equal(emitido1.fecha_evento, null, 'baja + huérfano: la fecha debe descartarse (null)')
assert.equal(r1.fechasVisionBajaDescartada, 1, 'contador bajaDescartada debe ser 1')
assert.equal(r1.fechasVisionBajaUsada, 0, 'contador bajaUsada debe ser 0')
assert.equal(r1.fechasVisionAlta, 0, 'contador alta debe ser 0')
assert.deepEqual(emitido1, busca(base, /cicloturism/i), 'el cartel debe quedar idéntico al estado sin visión')
console.log(`✔ Caso 1 (baja + huérfano → descartada): "${huerfano.titulo}" con fecha falsa ${FECHA_FALSA} queda fecha_evento=null, bajaDescartada=1, idéntico al estado de main`)

// ——— Caso 2: baja + empareja → usada ———
const FECHA_GALGOS = '2026-09-06' // la fecha real del acto en el programa
const r2 = await obtenerActividadesDeportivas(programaFiestas, {
  extraerFechas: soloObjetivo(FECHA_GALGOS, 'baja', emparejable.imagen),
})
const emitido2 = [...r2.actividades, ...r2.paraRevision].find(
  (a) => a.origen_externo_id === emparejable.origen_externo_id
)
assert.equal(emitido2.fecha_evento, FECHA_GALGOS, 'baja + empareja: la fecha debe usarse')
assert.ok(emitido2.enriqueceEvento, 'baja + empareja: debe enriquecer el evento del programa')
assert.equal(r2.fechasVisionBajaUsada, 1, 'contador bajaUsada debe ser 1')
assert.equal(r2.fechasVisionBajaDescartada, 0, 'contador bajaDescartada debe ser 0')
console.log(`✔ Caso 2 (baja + empareja → usada): "${emparejable.titulo}" ${FECHA_GALGOS} → enriquece ${emitido2.enriqueceEvento}, bajaUsada=1`)

// ——— Caso 3: alta + huérfano → usada siempre ———
const r3 = await obtenerActividadesDeportivas(programaFiestas, {
  extraerFechas: soloObjetivo(FECHA_FALSA, 'alta', huerfano.imagen),
})
const emitido3 = [...r3.actividades, ...r3.paraRevision].find(
  (a) => a.origen_externo_id === huerfano.origen_externo_id
)
assert.equal(emitido3.fecha_evento, FECHA_FALSA, 'alta + huérfano: la fecha debe usarse')
assert.equal(r3.fechasVisionAlta, 1, 'contador alta debe ser 1')
assert.equal(r3.fechasVisionBajaDescartada, 0, 'contador bajaDescartada debe ser 0')
console.log(`✔ Caso 3 (alta + huérfano → usada): "${huerfano.titulo}" conserva ${FECHA_FALSA}, alta=1`)

console.log('\nTodo OK: las tres ramas de confianza se comportan como está documentado.')
