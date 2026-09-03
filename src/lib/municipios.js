// Catálogo oficial de provincias y municipios de España (INE), generado por
// `npm run fetch:municipios` en src/data/municipios.json. Alimenta los
// desplegables Provincia → Municipio del formulario de eventos (ámbito 'otro')
// y la validación en servidor de api/admin/eventos.js.
//
// Módulo "limpio" (sin JSX) pero PESADO: importa ~200 KB de JSON. El
// formulario lo carga con import() dinámico solo cuando hace falta; no
// importarlo desde componentes públicos (usar textoPoblacion() de eventos.js
// para pintar "Móstoles (Madrid)", que no necesita el catálogo).

import catalogo from '../data/municipios.json'

/** Provincias ordenadas por nombre: [{ codigo: '28', nombre: 'Madrid' }]. */
export const PROVINCIAS = Object.entries(catalogo.provincias)
  .map(([codigo, nombre]) => ({ codigo, nombre }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

const CODIGO_POR_NOMBRE = new Map(PROVINCIAS.map((p) => [p.nombre, p.codigo]))

/** Código INE (2 dígitos) de una provincia por su nombre, o null. */
export const codigoDeProvincia = (nombre) => CODIGO_POR_NOMBRE.get(nombre) ?? null

/** Municipios de una provincia (por código), ya ordenados: [{ codigo, nombre }]. */
export function municipiosDe(codigoProvincia) {
  if (!codigoProvincia) return []
  return catalogo.municipios
    .filter(([codigo]) => codigo.startsWith(codigoProvincia))
    .map(([codigo, nombre]) => ({ codigo, nombre }))
}

/**
 * ¿Existe ese municipio en esa provincia? Nombres de municipio y provincia
 * tal como los guarda el evento (`poblacion`/`provincia`). Dentro de una
 * provincia no hay dos municipios con el mismo nombre, así que el par es
 * unívoco.
 */
export function municipioValido(provincia, municipio) {
  const codigo = codigoDeProvincia(provincia)
  if (!codigo) return false
  return catalogo.municipios.some(([c, n]) => c.startsWith(codigo) && n === municipio)
}

/**
 * Provincias en las que existe un municipio con ese nombre. Sirve para
 * prerrellenar la provincia de un evento guardado antes de que existiera la
 * columna (solo si el nombre es único en toda España).
 */
export function provinciasConMunicipio(municipio) {
  const codigos = new Set(catalogo.municipios.filter(([, n]) => n === municipio).map(([c]) => c.slice(0, 2)))
  return PROVINCIAS.filter((p) => codigos.has(p.codigo))
}
