/**
 * optimizar-imagenes.mjs
 *
 * Comprime las fotos del directorio de comercios (public/img/comercios,
 * subcarpetas incluidas): redimensiona a un ancho máximo de 900 px y
 * recomprime como JPEG progresivo (mozjpeg, calidad 72). Las tarjetas se
 * pintan a ~300-400 px, así que no hay pérdida visible.
 *
 * Es idempotente: una imagen ya optimizada apenas cambia de peso y se deja
 * como está si el resultado no mejora el original.
 *
 * Uso: npm run optimizar:imagenes   (ejecutar tras añadir fotos nuevas)
 */

import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { resolve, join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = resolve(ROOT, "public/img/comercios");
const ANCHO_MAX = 900;
const CALIDAD = 72;
const EXTENSIONES = new Set([".jpg", ".jpeg", ".png"]);

function listar(dir) {
  const rutas = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) rutas.push(...listar(ruta));
    else if (EXTENSIONES.has(extname(nombre).toLowerCase())) rutas.push(ruta);
  }
  return rutas;
}

const rutas = listar(DIR);
let antesTotal = 0;
let despuesTotal = 0;

for (const ruta of rutas) {
  // Se lee a memoria para que sharp no mantenga el fichero abierto (en
  // Windows impediría sobreescribirlo) y se escribe en el mismo sitio.
  const original = readFileSync(ruta);
  const antes = original.length;

  const optimizada = await sharp(original)
    .rotate() // respeta la orientación EXIF antes de descartar metadatos
    .resize({ width: ANCHO_MAX, withoutEnlargement: true })
    .jpeg({ quality: CALIDAD, mozjpeg: true, progressive: true })
    .toBuffer();

  if (optimizada.length < antes) writeFileSync(ruta, optimizada);

  const final = Math.min(antes, optimizada.length);
  antesTotal += antes;
  despuesTotal += final;
  const rel = ruta.slice(DIR.length + 1);
  console.log(
    `${rel.padEnd(36)} ${(antes / 1024).toFixed(0).padStart(6)} KB → ${(final / 1024)
      .toFixed(0)
      .padStart(5)} KB`,
  );
}

console.log("-".repeat(60));
console.log(
  `Total: ${(antesTotal / 1048576).toFixed(1)} MB → ${(despuesTotal / 1048576).toFixed(1)} MB` +
    ` (−${(100 - (despuesTotal / antesTotal) * 100).toFixed(0)}%)`,
);
