/**
 * optimizar-imagenes.mjs
 *
 * Comprime fotos de un directorio de assets (subcarpetas incluidas):
 * redimensiona a un ancho máximo y recomprime como JPEG progresivo
 * (mozjpeg, calidad 72).
 *
 * Dos objetivos, elegidos con --dir (por defecto comercios, el histórico):
 *  - comercios (public/img/comercios): ancho máx 900 px — las tarjetas se
 *    pintan a ~300-400 px, así que no hay pérdida visible.
 *  - eventos (public/img/eventos): ancho máx 1200 px — el héroe de la ficha
 *    de detalle llega a ~1344 px CSS×DPR2, y las ilustrativas de galería se
 *    usan también ahí, no solo en tarjeta.
 *
 * Es idempotente: una imagen ya optimizada apenas cambia de peso y se deja
 * como está si el resultado no mejora el original.
 *
 * Uso: npm run optimizar:imagenes            (comercios, tras añadir fotos)
 *      npm run optimizar:eventos             (galería de ilustrativas)
 */

import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { resolve, join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OBJETIVOS = {
  comercios: { dir: "public/img/comercios", anchoMax: 900 },
  // `excluir`: vive25/ son los carteles reales del programa VIVE curados a
  // mano, no ilustrativas de galería — se dejan tal cual llegaron.
  eventos: { dir: "public/img/eventos", anchoMax: 1200, excluir: new Set(["vive25"]) },
};
const argDir = process.argv.find((a) => a.startsWith("--dir="))?.slice(6) ?? "comercios";
const objetivo = OBJETIVOS[argDir];
if (!objetivo) {
  console.error(`--dir debe ser uno de: ${Object.keys(OBJETIVOS).join(", ")}`);
  process.exit(1);
}
const DIR = resolve(ROOT, objetivo.dir);
const ANCHO_MAX = objetivo.anchoMax;
const CALIDAD = 72;
const EXTENSIONES = new Set([".jpg", ".jpeg", ".png"]);

function listar(dir) {
  const rutas = [];
  for (const nombre of readdirSync(dir)) {
    if (objetivo.excluir?.has(nombre)) continue;
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
