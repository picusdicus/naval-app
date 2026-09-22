// Test del parser y del emparejamiento de la taquilla del Teatro Municipal
// Centro sobre HTML guardado el 2026-09-22 (tests/fixtures/sacatuentrada/):
// no depende de que la fuente esté disponible ni de que no haya cambiado.
// Ejecutar con `npm run test:unit` (node --test, sin dependencias).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parsearPortada,
  parsearDetalle,
  parsearEntradas,
  tituloDeObra,
  certamenDeRotulo,
  precioLegible,
  urlsDeCartel,
  idDeObra,
  emparejarObrasConFilas,
} from '../api/_sacatuentrada-feed.js'
import { imagenSustituible } from '../api/_sacatuentrada-revision.js'

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'sacatuentrada')
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8')

test('la portada del 22-sep da 7 obras con todos los campos', () => {
  const obras = parsearPortada(leer('portada-2026-09-22.html'))
  assert.equal(obras.length, 7)
  assert.deepEqual(
    obras.map((o) => o.fecha),
    ['2026-09-26', '2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07'],
  )
  const [julieta] = obras
  assert.equal(julieta.idFuente, '416925')
  assert.equal(idDeObra(julieta), 'ste-416925-2026-09-26')
  assert.equal(julieta.rotulo, 'JULIETA Y ROMEO. CETAN 2026')
  assert.equal(julieta.titulo, 'Julieta y romeo')
  assert.equal(julieta.certamen, 'CETAN 2026')
  assert.equal(julieta.categoria, 'teatro')
  assert.equal(julieta.lugar, 'TEATRO MUNICIPAL CENTRO')
  assert.equal(julieta.compania, 'Asociación Cultural Tomatelon, Madrid')
  assert.equal(julieta.precio, '5 €')
  assert.equal(julieta.urlCompra, 'https://teatrocentro.sacatuentrada.es/es/entradas/julieta-y-romeo-cetan-2026/2026-09-26')
  assert.equal(julieta.urlDetalle, 'https://teatrocentro.sacatuentrada.es/es/productos/descripcion/julieta-y-romeo-cetan-2026')
  assert.deepEqual(julieta.urlsCartel, [
    'https://cdn.tenemosplan.com/tiendas/1788776941.4336_5fe969d5f996d5ca3cca94129505862e',
    'https://cdn.tenemosplan.com/tiendas/0_1788776941.4336_5fe969d5f996d5ca3cca94129505862e',
  ])
  assert.match(julieta.textoVenta, /^Precio de la entrada: 5€ precio único/)
  for (const o of obras) {
    assert.ok(o.urlCompra && o.urlDetalle && o.urlsCartel.length === 2 && o.compania, o.slug)
    assert.equal(o.precio, '5 €')
  }
  // Ids distintos por obra (dos obras comparten el hash de imagen pero no el id)
  assert.equal(new Set(obras.map(idDeObra)).size, 7)
})

test('detalle: sinopsis con la línea de género/público/duración, sin cortes de <br>', () => {
  const { sinopsis } = parsearDetalle(leer('detalle-julieta-y-romeo.html'))
  assert.match(sinopsis, /^Teatro Musical\. Todos los públicos\. 2h\. 20' aprox\. \(2 actos\)\n/)
  assert.match(sinopsis, /el final que todos conocemos\? En este divertido/) // el <br> a mitad de frase no parte la línea
  assert.match(sinopsis, /¡Mejor vivir para contarlo!$/)
})

test('entradas: hora de la sesión', () => {
  assert.deepEqual(parsearEntradas(leer('entradas-julieta-y-romeo.html')), { hora: '20:00', sesiones: 1 })
})

test('helpers de título, certamen, precio y cartel', () => {
  assert.equal(tituloDeObra('CASA CON DOS PUERTAS, MALA ES DE GUARDAR. CETAN 2026'), 'Casa con dos puertas, mala es de guardar')
  assert.equal(tituloDeObra('ANASTASIA, LA PRINCESA ROMANOV. CETAN 2026'), 'Anastasia, la princesa romanov')
  assert.equal(tituloDeObra('Dulcinea'), 'Dulcinea') // sin coletilla y ya legible: intacto
  assert.equal(tituloDeObra('CONCIERTO DE NAVIDAD'), 'Concierto de navidad')
  assert.equal(certamenDeRotulo('LO NUNCA VISTO. CETAN 2026'), 'CETAN 2026')
  assert.equal(certamenDeRotulo('Dulcinea'), '')
  assert.equal(precioLegible('5&euro;'), '5 €')
  assert.equal(precioLegible('12.50€'), '12,50 €')
  assert.equal(precioLegible('Gratis'), 'Gratis')
  assert.deepEqual(urlsDeCartel('https://cdn.tenemosplan.com/tenemosplan/no_image.jpg'), [])
  assert.deepEqual(urlsDeCartel('https://cdn.x/tiendas/abc'), ['https://cdn.x/tiendas/abc'])
})

test('emparejamiento: las 7 filas reales del CETAN, el paraguas del 26-sep no se lleva nada', () => {
  const obras = parsearPortada(leer('portada-2026-09-22.html'))
  // Títulos y fechas EXACTOS de las filas de eventos_usuario del 2026-09-22
  // (hijas del cartel-programa ig-DdEMenXnDIM, más el paraguas del mismo post).
  const lugar = 'Teatro Municipal Centro'
  const filas = [
    { id: 'paraguas', titulo: 'CETAN 2026: Certamen de Teatro de Navalcarnero', fecha: '2026-09-26', lugar, origen_externo_id: 'ig-DdEMenXnDIM' },
    { id: 'julieta', titulo: 'Julieta y Romeo', fecha: '2026-09-26', lugar, origen_externo_id: 'ig-DdEMenXnDIM-julieta-y-romeo' },
    { id: 'cinco', titulo: 'Así que pasen 5 años', fecha: '2026-10-03', lugar, origen_externo_id: 'ig-x' },
    { id: 'nunca', titulo: 'Lo nunca visto', fecha: '2026-10-10', lugar, origen_externo_id: 'ig-x' },
    { id: 'anastasia', titulo: 'Anastasia', fecha: '2026-10-17', lugar, origen_externo_id: 'ig-x' },
    { id: 'dice', titulo: 'Lo que no se dice', fecha: '2026-10-24', lugar, origen_externo_id: 'ig-x' },
    { id: 'invito', titulo: 'A esta invito yo', fecha: '2026-10-31', lugar, origen_externo_id: 'ig-x' },
    { id: 'casa', titulo: 'Casa con dos puertas mala es de guardar', fecha: '2026-11-07', lugar, origen_externo_id: 'ig-x' },
    { id: 'ecos', titulo: 'Ecos de escena', fecha: '2026-11-14', lugar, origen_externo_id: 'ig-x' },
    // Ruido: misma fecha en otro lugar, y otra fecha en el mismo lugar
    { id: 'otro-lugar', titulo: 'Anastasia', fecha: '2026-10-17', lugar: 'La Nave', origen_externo_id: null },
  ]
  const { emparejadas, sinPareja } = emparejarObrasConFilas(obras, filas)
  assert.equal(sinPareja.length, 0)
  assert.deepEqual(
    emparejadas.map((e) => [e.fila.id, e.nivel]),
    [
      ['julieta', 'equivalente'],
      ['cinco', 'aproximado'],
      ['nunca', 'equivalente'],
      ['anastasia', 'fecha-lugar'],
      ['dice', 'equivalente'],
      ['invito', 'aproximado'],
      ['casa', 'equivalente'],
    ],
  )
})

test('emparejamiento: nivel 0 (fila propia), sin pareja, y ambigüedad por fecha y lugar', () => {
  const obras = parsearPortada(leer('portada-2026-09-22.html')).slice(0, 2)
  const lugar = 'TEATRO MUNICIPAL CENTRO'
  const { emparejadas, sinPareja } = emparejarObrasConFilas(obras, [
    { id: 'propia', titulo: 'Otro título cualquiera', fecha: '2026-09-26', lugar, origen_externo_id: 'ste-416925-2026-09-26' },
    // 3-oct: dos filas sin coincidencia de título ⇒ ambiguo ⇒ sin pareja
    { id: 'a', titulo: 'Concierto de otoño', fecha: '2026-10-03', lugar, origen_externo_id: null },
    { id: 'b', titulo: 'Gala benéfica', fecha: '2026-10-03', lugar, origen_externo_id: null },
  ])
  assert.deepEqual(emparejadas.map((e) => [e.fila.id, e.nivel]), [['propia', 'propia']])
  assert.deepEqual(sinPareja.map((o) => o.slug), ['asi-que-pasen-cinco-años-cetan-2026'])
})

test('imagenSustituible: solo carteles de ingesta o filas sin imagen, nunca uno subido a mano ni el nuestro', () => {
  assert.equal(imagenSustituible({ imagen_url: null, origen_externo_id: null }), true)
  assert.equal(imagenSustituible({ imagen_url: 'https://x/instagram/DdEMenXnDIM-c0.jpg', origen_externo_id: 'ig-x' }), true)
  assert.equal(imagenSustituible({ imagen_url: 'https://x/eventos/tyl-tyl/cartel.jpg', origen_externo_id: null }), false)
  assert.equal(imagenSustituible({ imagen_url: 'https://x/sacatuentrada/416925.png', origen_externo_id: 'ig-x' }), false)
})
