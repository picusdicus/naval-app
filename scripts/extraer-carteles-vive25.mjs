// Extrae los carteles del PDF de la agenda municipal "VIVE Navalcarnero nº 25"
// (junio, julio y agosto de 2026) a public/img/eventos/vive25/.
//
// Es un script de un solo uso: el PDF es un volcado manual, no una fuente que
// se regenere (por eso no está en los `fetch:*` de package.json). Si el
// Ayuntamiento publica el nº 26, se vuelve a lanzar cambiando PDF_ENTRADA.
//
//   node scripts/extraer-carteles-vive25.mjs [ruta-al-pdf]
//
// Recorre las páginas, saca los bloques de imagen de cada una y descarta las
// pequeñas (logos, escudos, QRs) por ancho mínimo. Deja un fichero por imagen
// grande, nombrado por página — p. ej. p48.jpg para la portada de las Bodas de
// Felipe IV — para poder emparejarlas a mano con los eventos del JSON.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as mupdf from 'mupdf'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const PDF_ENTRADA =
  process.argv[2] ||
  'C:\\Users\\daniel.molino\\Downloads\\25.-Junio-julio-y-agosto-2026-web.pdf'
const DIR_SALIDA = path.join(RAIZ, 'public', 'img', 'eventos', 'vive25')

// Por debajo de esto es un logo, un escudo o un QR, no un cartel.
const ANCHO_MINIMO = 400
// Las fotos se sirven como cartel de tarjeta; más de 900 px es peso muerto.
const ANCHO_MAXIMO = 900
const CALIDAD_JPEG = 78

// Reescala un pixmap a `anchoDestino` conservando la proporción y, si hace
// falta, lo endereza. mupdf no trae un `resize`, pero `warp` sobre las cuatro
// esquinas hace las dos cosas: mapea el cuadrilátero de origen (en orden
// arriba-izq, arriba-der, abajo-der, abajo-izq) al rectángulo de destino, así
// que dar las esquinas en orden invertido voltea la imagen.
//
// El volteo hace falta porque `Image.toPixmap()` devuelve las filas en el orden
// de almacenamiento del PDF, mientras que la matriz del bloque lleva la escala
// vertical negativa (`transform[3] < 0`) que las endereza al pintar la página.
function normalizar(pixmap, anchoDestino, volteada) {
  const w = pixmap.getWidth()
  const h = pixmap.getHeight()
  const ancho = Math.min(w, anchoDestino)
  const alto = Math.round((h * ancho) / w)
  const esquinas = volteada
    ? [
        [0, h],
        [w, h],
        [w, 0],
        [0, 0],
      ]
    : [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ]
  return pixmap.warp(esquinas, ancho, alto)
}

// Las imágenes en CMYK o escala de grises hay que pasarlas a RGB antes de
// guardarlas como JPEG, o salen con los colores invertidos.
function aRGB(pixmap) {
  const cs = pixmap.getColorSpace()
  if (cs && cs.getNumberOfComponents() === 3) return pixmap
  return pixmap.convertToColorSpace(mupdf.ColorSpace.DeviceRGB, false)
}

function main() {
  if (!fs.existsSync(PDF_ENTRADA)) {
    console.error(`No encuentro el PDF: ${PDF_ENTRADA}`)
    process.exit(1)
  }
  fs.mkdirSync(DIR_SALIDA, { recursive: true })

  const doc = mupdf.Document.openDocument(fs.readFileSync(PDF_ENTRADA), 'application/pdf')
  const paginas = doc.countPages()
  console.log(`${paginas} páginas en ${path.basename(PDF_ENTRADA)}\n`)

  let guardadas = 0
  let descartadas = 0

  for (let i = 0; i < paginas; i++) {
    const numero = i + 1
    const pagina = doc.loadPage(i)
    const texto = pagina.toStructuredText('preserve-images')

    // Puede haber varias imágenes por página (el cartel y algún adorno); nos
    // quedamos con las que superen el ancho mínimo y numeramos si hay más de una.
    const candidatas = []
    texto.walk({
      onImageBlock(_bbox, transform, imagen) {
        // transform[3] es la escala vertical del bloque: negativa = hay que voltear.
        if (imagen.getWidth() >= ANCHO_MINIMO) candidatas.push({ imagen, volteada: transform[3] < 0 })
        else descartadas++
      },
    })

    candidatas.forEach(({ imagen, volteada }, indice) => {
      const sufijo = candidatas.length > 1 ? `-${indice + 1}` : ''
      const nombre = `p${String(numero).padStart(2, '0')}${sufijo}.jpg`
      try {
        const jpeg = normalizar(aRGB(imagen.toPixmap()), ANCHO_MAXIMO, volteada).asJPEG(CALIDAD_JPEG)
        fs.writeFileSync(path.join(DIR_SALIDA, nombre), jpeg)
        const kb = Math.round(jpeg.length / 1024)
        console.log(
          `  ${nombre}  ${imagen.getWidth()}x${imagen.getHeight()} → ${kb} KB`,
        )
        guardadas++
      } catch (err) {
        // Un cartel que no se deja convertir no rompe la extracción: el evento
        // se quedará sin `imagen` y la app cae a la foto por categoría.
        console.warn(`  ${nombre}  ERROR: ${err.message}`)
      }
    })
  }

  console.log(
    `\n${guardadas} carteles en ${path.relative(RAIZ, DIR_SALIDA)} (${descartadas} imágenes pequeñas descartadas)`,
  )
  console.log('Revisa las imágenes a ojo antes de referenciarlas en eventos.json.')
}

main()
