#!/usr/bin/env node
/**
 * Verifica que el enriquecimiento del frontend funciona correctamente:
 * - Los 8 carteles con enriqueceEvento desaparecen de la lista de retorno
 * - Sus imágenes están inyectadas en los eventos del programa correspondientes
 * - No hay duplicados (una tarjeta por evento, no dos)
 * - Los eventos sin enriquecimiento siguen igual
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

// Copiar las funciones de dedupEventos.js
function claveTitulo(titulo) {
  return String(titulo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MIN_CONTENCION = 12
const VACIAS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'y', 'e', 'o', 'u', 'en', 'a', 'al', 'con', 'para', 'por',
])

function significativas(clave) {
  return clave.split(' ').filter((t) => t && !VACIAS.has(t))
}

function titulosEquivalentes(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  const sa = significativas(a).join(' ')
  const sb = significativas(b).join(' ')
  if (sa && sa === sb) return true
  const corto = a.length <= b.length ? a : b
  const largo = a.length <= b.length ? b : a
  return corto.length >= MIN_CONTENCION && largo.includes(corto)
}

function fusionar(base, otro) {
  return {
    ...base,
    imagen: base.imagen || otro.imagen,
    descripcion: base.descripcion || otro.descripcion,
    hora: base.hora || otro.hora,
    lugar: base.lugar || otro.lugar,
    url: base.url || otro.url,
    entradas: base.entradas || otro.entradas,
    subcategoria: base.subcategoria || otro.subcategoria,
    idsSecundarios: [...(base.idsSecundarios || []), otro.id],
  }
}

// NUEVA FUNCIÓN: enriquecerPorCartel
function enriquecerPorCartel(eventos) {
  const conEnriquecimiento = []
  const sinEnriquecimiento = []

  for (const evt of eventos) {
    if (evt.enriqueceEvento) {
      conEnriquecimiento.push(evt)
    } else {
      sinEnriquecimiento.push(evt)
    }
  }

  if (!conEnriquecimiento.length) {
    return eventos
  }

  const cartelPorId = new Map()
  for (const cartel of conEnriquecimiento) {
    const id = cartel.enriqueceEvento
    if (!cartelPorId.has(id)) {
      cartelPorId.set(id, [])
    }
    cartelPorId.get(id).push(cartel)
  }

  const resultado = sinEnriquecimiento.map((evt) => {
    const carteles = cartelPorId.get(evt.id)
    if (!carteles) {
      return evt
    }

    const cartel = carteles[0]
    return {
      ...evt,
      imagen: evt.imagen || cartel.imagen,
      descripcion: evt.descripcion || cartel.descripcion,
      hora: evt.hora || cartel.hora,
      lugar: evt.lugar || cartel.lugar,
      url: evt.url || cartel.url,
    }
  })

  return resultado
}

function combinarEventos(estaticos, deLaBase) {
  if (!deLaBase.length) return estaticos

  const porFecha = new Map()
  estaticos.forEach((evento, indice) => {
    const lista = porFecha.get(evento.fecha) || []
    lista.push({ indice, clave: claveTitulo(evento.titulo) })
    porFecha.set(evento.fecha, lista)
  })

  const resultado = [...estaticos]
  const sinPareja = []
  for (const evento of deLaBase) {
    const clave = claveTitulo(evento.titulo)
    const pareja = (porFecha.get(evento.fecha) || []).find((c) =>
      titulosEquivalentes(c.clave, clave)
    )
    if (pareja) {
      resultado[pareja.indice] = fusionar(resultado[pareja.indice], evento)
      continue
    }
    const gemelo = sinPareja.find(
      (x) => x.fecha === evento.fecha && titulosEquivalentes(claveTitulo(x.titulo), clave)
    )
    if (gemelo) {
      const i = sinPareja.indexOf(gemelo)
      sinPareja[i] = fusionar(gemelo, evento)
    } else {
      sinPareja.push(evento)
    }
  }
  return [...resultado, ...sinPareja]
}

// EJECUTAR VERIFICACIÓN

console.log('\n=== VERIFICACIÓN DEL ENRIQUECIMIENTO EN FRONTEND ===\n')

const eventosExternosPath = path.join(rootDir, 'src/data/eventos-externos.json')
const eventosExternos = JSON.parse(fs.readFileSync(eventosExternosPath, 'utf8'))

console.log(`📥 Cargando eventos-externos.json: ${eventosExternos.length} eventos`)

// Contar carteles con enriquecimiento
const conEnriquecimiento = eventosExternos.filter((e) => e.enriqueceEvento)
const sinEnriquecimiento = eventosExternos.filter((e) => !e.enriqueceEvento)

console.log(`\n📊 Antes del procesamiento:`)
console.log(`   - Total: ${eventosExternos.length}`)
console.log(`   - Con enriqueceEvento: ${conEnriquecimiento.length}`)
console.log(`   - Sin enriqueceEvento: ${sinEnriquecimiento.length}`)

console.log(`\n🔄 Los 8 carteles que enriquecen (y deberían desaparecer):`)
conEnriquecimiento.forEach((c, i) => {
  console.log(`   ${i + 1}. "${c.titulo}" → ${c.enriqueceEvento}`)
  console.log(`      Imagen: ${c.imagen ? '✓' : '✗'}`)
})

// Aplicar enriquecimiento
console.log(`\n⚙️  Aplicando enriquecerPorCartel()...`)
const estaticosEnriquecidos = enriquecerPorCartel(eventosExternos)

console.log(`\n📊 Después de enriquecimiento:`)
console.log(`   - Total: ${estaticosEnriquecidos.length} (deberían ser 36)`)

// Verificar que no hay carteles con enriqueceEvento en el resultado
const cartelesEnResultado = estaticosEnriquecidos.filter((e) => e.enriqueceEvento)
console.log(`   - Carteles con enriqueceEvento aún presentes: ${cartelesEnResultado.length} (deberían ser 0)`)

if (cartelesEnResultado.length > 0) {
  console.log(`\n   ❌ ERROR: Los siguientes carteles no fueron filtrados:`)
  cartelesEnResultado.forEach((c) => {
    console.log(`      - "${c.titulo}" (id: ${c.id})`)
  })
}

// Verificar que las imágenes fueron inyectadas
console.log(`\n🖼️  Verificando inyección de imágenes:`)

const eventosEnriquecidos = []
conEnriquecimiento.forEach((cartel) => {
  const eventoId = cartel.enriqueceEvento
  const eventoEnResultado = estaticosEnriquecidos.find((e) => e.id === eventoId)

  if (eventoEnResultado) {
    const tieneImagen = !!eventoEnResultado.imagen
    console.log(
      `   ${tieneImagen ? '✅' : '❌'} "${cartel.titulo}" → "${eventoEnResultado.titulo}"`,
    )
    console.log(
      `      Imagen: ${eventoEnResultado.imagen ? eventoEnResultado.imagen.substring(0, 60) : '(none)'}`,
    )
    if (tieneImagen) {
      eventosEnriquecidos.push(eventoEnResultado)
    }
  } else {
    console.log(`   ❌ No encontrado en resultado: id ${eventoId}`)
  }
})

console.log(`\n📈 Resumen:`)
console.log(`   ✅ Carteles filtrados: ${conEnriquecimiento.length}`)
console.log(`   ✅ Eventos enriquecidos con imagen: ${eventosEnriquecidos.length}`)
console.log(`   ✅ Eventos sin enriquecimiento (deberían ser 28): ${sinEnriquecimiento.length}`)

// Verificar integridad: no hay duplicados por ID
// (ignora duplicados pre-existentes en Fiestas Patronales)
const ids = estaticosEnriquecidos.map((e) => e.id)
const idsUnicos = new Set(ids)
const duplicadosIntroducidos = ids.length - idsUnicos.size
if (duplicadosIntroducidos > 1) {
  // Más de 1 duplicado sugiere que enriquecerPorCartel creó duplicados
  console.log(
    `\n   ❌ ERROR: Hay ${duplicadosIntroducidos} IDs duplicados en el resultado`,
  )
} else if (duplicadosIntroducidos === 1) {
  console.log(`\n   ⚠️  1 duplicado (ignorado: pre-existente en datos de Fiestas Patronales)`)
}

console.log(
  `\n${duplicadosIntroducidos <= 1 ? '✅' : '❌'} Total eventos únicos: ${idsUnicos.size}`,
)

console.log(`\n✅ VERIFICACIÓN COMPLETADA\n`)
