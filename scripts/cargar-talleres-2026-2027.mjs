// Carga inicial del catálogo de talleres municipales 2026/2027.
//
// SCRIPT DE UN SOLO USO, no un importador reutilizable: los datos van
// transcritos aquí a mano desde el PDF municipal
// (HORARIOS-TALLERES-MUNICIPALES-CURSO-2026-20271.pdf), que es la fuente de
// verdad — la primera carga se hizo desde capturas y coló un día erróneo en
// Bailes de salón (ver git log de este fichero). La importación por PDF
// es la fase 2 y no tiene nada que ver con esto — no construir sobre este
// fichero, borrarlo cuando el importador exista.
//
//   node scripts/cargar-talleres-2026-2027.mjs [--dry-run]
//
// Idempotente por (nombre, curso): re-ejecutarlo actualiza los talleres ya
// cargados y reescribe sus turnos, en vez de duplicarlos. Así una corrección
// del catálogo se aplica volviendo a lanzarlo.

import { readFileSync, existsSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

const CURSO = '2026/2027'
const DRY = process.argv.includes('--dry-run')

// dias: ids de src/lib/talleres.js (lunes…domingo). Un turno sin días ni horas
// ("Historia del arte") se publica como "Por determinar", que es exactamente
// lo que dice el folleto.
const CATALOGO = [
  {
    nombre: 'Pintura adultos iniciación',
    categoria: 'pintura',
    edades: 'A partir de 16 años',
    lugar: 'Casa de la Cultura',
    precio: '22 €/mes',
    turnos: [
      { dias: ['lunes'], horaInicio: '17:30', horaFin: '19:30' },
      { dias: ['lunes'], horaInicio: '19:30', horaFin: '21:30' },
    ],
  },
  {
    nombre: 'Pintura adultos avanzado',
    categoria: 'pintura',
    edades: 'A partir de 18 años',
    lugar: 'Casa de la Cultura',
    precio: '22 €/mes',
    turnos: [{ dias: ['miercoles'], horaInicio: '17:30', horaFin: '19:30' }],
  },
  {
    nombre: 'Pintura infantil',
    categoria: 'pintura',
    edades: 'De 6 a 15 años',
    lugar: 'Casa de la Cultura',
    precio: '21 €/mes',
    turnos: [
      { etiqueta: 'De 6 a 10 años', dias: ['sabado'], horaInicio: '10:30', horaFin: '12:00' },
      { etiqueta: 'De 11 a 15 años', dias: ['sabado'], horaInicio: '12:00', horaFin: '14:00' },
    ],
  },
  {
    nombre: 'Talla en madera',
    categoria: 'talla-madera',
    edades: 'A partir de 18 años',
    lugar: 'Casa de la Cultura',
    precio: '22 €/mes',
    turnos: [
      { dias: ['lunes'], horaInicio: '16:00', horaFin: '18:30' },
      { dias: ['lunes'], horaInicio: '18:30', horaFin: '21:00' },
    ],
  },
  {
    nombre: 'Restauración',
    categoria: 'restauracion',
    edades: 'A partir de 18 años',
    lugar: 'Casa de la Cultura',
    precio: '22 €/mes',
    turnos: [
      { dias: ['miercoles'], horaInicio: '16:00', horaFin: '18:30' },
      { dias: ['miercoles'], horaInicio: '18:30', horaFin: '21:00' },
    ],
  },
  {
    nombre: 'Historia del arte y literatura',
    categoria: 'historia-arte',
    edades: 'A partir de 18 años',
    lugar: 'Por determinar',
    precio: '22 €/mes',
    // El folleto no concreta el horario: turno vacío ⇒ "Por determinar".
    turnos: [{}],
  },
  {
    nombre: 'Teatro',
    categoria: 'teatro',
    lugar: 'Centro de Artes Escénicas',
    precio: '30 €/mes',
    turnos: [
      { etiqueta: 'De 3 a 6 años', dias: ['miercoles'], horaInicio: '17:00', horaFin: '18:30' },
      { etiqueta: 'De 7 a 11 años', dias: ['miercoles'], horaInicio: '18:30', horaFin: '20:30' },
      { etiqueta: 'De 12 a 17 años', dias: ['jueves'], horaInicio: '18:00', horaFin: '20:00' },
      { etiqueta: 'Adultos', dias: ['jueves'], horaInicio: '20:00', horaFin: '22:00' },
    ],
  },
  {
    nombre: 'Relajación y cuidado de la espalda',
    categoria: 'bienestar',
    edades: 'A partir de 18 años',
    // Sus tres turnos se reparten entre dos sedes, así que cada uno lleva el
    // suyo y el taller se queda con el más frecuente.
    lugar: 'Casa de la Cultura',
    precio: '22 €/mes',
    turnos: [
      { dias: ['martes', 'jueves'], horaInicio: '11:00', horaFin: '12:00', lugar: 'Casa de la Cultura' },
      { dias: ['lunes', 'miercoles'], horaInicio: '19:00', horaFin: '20:00', lugar: 'Casa de la Cultura' },
      { dias: ['martes', 'jueves'], horaInicio: '19:00', horaFin: '20:00', lugar: 'Centro de Artes Escénicas' },
    ],
  },
  {
    nombre: 'Yoga',
    categoria: 'yoga',
    edades: 'A partir de 18 años',
    lugar: 'Casa de la Cultura',
    precio: '22 €/mes',
    turnos: [{ dias: ['martes', 'jueves'], horaInicio: '10:00', horaFin: '11:00' }],
  },
  {
    nombre: 'Pilates',
    categoria: 'pilates',
    edades: 'A partir de 18 años',
    lugar: 'Centro de Artes Escénicas',
    precio: '22 €/mes',
    turnos: [
      { dias: ['martes', 'jueves'], horaInicio: '10:00', horaFin: '11:00' },
      { dias: ['martes', 'jueves'], horaInicio: '11:00', horaFin: '12:00' },
      { dias: ['lunes', 'miercoles'], horaInicio: '17:30', horaFin: '18:30' },
      { dias: ['lunes', 'miercoles'], horaInicio: '18:30', horaFin: '19:30' },
      { dias: ['lunes', 'miercoles'], horaInicio: '19:30', horaFin: '20:30' },
    ],
  },
  {
    nombre: 'Batucada',
    categoria: 'batucada',
    edades: 'A partir de 18 años',
    lugar: 'Teatro Municipal Centro',
    precio: '22 €/mes',
    turnos: [{ dias: ['martes'], horaInicio: '19:00', horaFin: '20:30' }],
  },
  {
    nombre: 'Danza oriental',
    categoria: 'danza-oriental',
    edades: 'A partir de 18 años',
    lugar: 'Centro de Artes Escénicas',
    precio: '14 €/mes',
    turnos: [{ dias: ['miercoles'], horaInicio: '19:15', horaFin: '20:45' }],
  },
  {
    nombre: 'Bailes latinos',
    categoria: 'bailes-latinos',
    edades: 'A partir de 18 años',
    lugar: 'Casa de la Cultura',
    precio: '17 €/mes',
    turnos: [
      { etiqueta: 'Nivel iniciación', dias: ['jueves'], horaInicio: '21:00', horaFin: '22:15' },
      { etiqueta: 'Nivel medio', dias: ['jueves'], horaInicio: '19:45', horaFin: '21:00' },
      { etiqueta: 'Nivel avanzado', dias: ['viernes'], horaInicio: '21:00', horaFin: '22:15' },
    ],
  },
  {
    nombre: 'Bailes de salón',
    categoria: 'bailes-salon',
    edades: 'A partir de 18 años',
    lugar: 'Casa de la Cultura',
    precio: '17 €/mes',
    turnos: [
      { etiqueta: 'Nivel iniciación-medio', dias: ['jueves'], horaInicio: '18:30', horaFin: '19:45' },
      { etiqueta: 'Nivel medio-avanzado', dias: ['viernes'], horaInicio: '18:30', horaFin: '19:45' },
      { etiqueta: 'Nivel avanzado', dias: ['viernes'], horaInicio: '19:45', horaFin: '21:00' },
    ],
  },
]

function urlBaseDeDatos() {
  for (const fichero of ['.env.local', '.env']) {
    if (!existsSync(fichero)) continue
    for (const linea of readFileSync(fichero, 'utf8').split(/\r?\n/)) {
      const m = linea.match(/^DATABASE_URL=(.*)$/)
      if (m) return m[1].trim().replace(/^["']|["']$/g, '')
    }
  }
  return process.env.DATABASE_URL || ''
}

async function main() {
  const url = urlBaseDeDatos()
  if (!url) {
    console.error('Falta DATABASE_URL (.env.local o .env).')
    process.exit(1)
  }
  const sql = neon(url)

  let creados = 0
  let actualizados = 0

  for (const taller of CATALOGO) {
    const turnos = taller.turnos ?? []
    if (DRY) {
      console.log(`· ${taller.nombre} (${taller.categoria}) — ${turnos.length} turno(s)`)
      continue
    }

    const [existente] = await sql`
      SELECT id FROM talleres WHERE nombre = ${taller.nombre} AND curso = ${CURSO}
    `

    let id
    if (existente) {
      const [fila] = await sql`
        UPDATE talleres SET
          categoria = ${taller.categoria}, lugar = ${taller.lugar ?? null},
          precio = ${taller.precio ?? null}, edades = ${taller.edades ?? null},
          descripcion = ${taller.descripcion ?? null}, estado = 'publicado',
          actualizado_en = now()
        WHERE id = ${existente.id}
        RETURNING id
      `
      id = fila.id
      actualizados += 1
    } else {
      const [fila] = await sql`
        INSERT INTO talleres (nombre, categoria, lugar, precio, edades, descripcion, curso, estado)
        VALUES (${taller.nombre}, ${taller.categoria}, ${taller.lugar ?? null},
                ${taller.precio ?? null}, ${taller.edades ?? null},
                ${taller.descripcion ?? null}, ${CURSO}, 'publicado')
        RETURNING id
      `
      id = fila.id
      creados += 1
    }

    // Reemplazo completo de los turnos, igual que hace el PUT del endpoint.
    await sql`DELETE FROM talleres_horarios WHERE taller_id = ${id}`
    for (const [i, t] of turnos.entries()) {
      await sql`
        INSERT INTO talleres_horarios (taller_id, etiqueta, dias, hora_inicio, hora_fin, lugar, orden)
        VALUES (${id}, ${t.etiqueta ?? null}, ${t.dias ?? []}, ${t.horaInicio ?? null},
                ${t.horaFin ?? null}, ${t.lugar ?? null}, ${i})
      `
    }
    console.log(`✓ ${taller.nombre} — ${turnos.length} turno(s)`)
  }

  console.log(
    DRY
      ? `\n(dry-run) ${CATALOGO.length} talleres, ${CATALOGO.reduce((n, t) => n + (t.turnos?.length ?? 0), 0)} turnos.`
      : `\n${creados} creados, ${actualizados} actualizados.`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
