// Dedup de la agenda pública: el mismo evento puede llegar por dos caminos —
// curado a mano en eventos.json (p. ej. el programa VIVE del verano) y creado
// en Neon por el scrapper de Instagram cuando el Ayuntamiento lo anuncia con
// un post. Aquí se fusionan en una sola tarjeta: la versión estática es la
// base (lugar y categoría revisados a mano) y la de la base de datos solo
// RELLENA lo que falte (típicamente la foto del cartel, que los curados no
// suelen tener). El id del duplicado se conserva en `idsSecundarios` para que
// los deep links de la bandeja de avisos y las referencias de destacados
// (`bd-<uuid>`) sigan resolviendo al evento fusionado.
//
// Módulo "limpio" (sin JSX/JSON) a propósito, como tarifasDestacados.js: la
// clave de título puede hacer falta también en handlers de api/.

/** Título normalizado para comparar: minúsculas, sin acentos ni puntuación. */
export function claveTitulo(titulo) {
  return String(titulo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Con menos de 12 caracteres la contención da falsos positivos ("cine" está
// contenido en media cartelera de verano); la igualdad exacta vale siempre.
const MIN_CONTENCION = 12

/** Iguales tras normalizar, o uno contenido en el otro si es lo bastante
 * largo — cubre "Cine de verano: Minecraft" vs "Cine de verano: Una película
 * de Minecraft" sin fusionar títulos genéricos. */
export function titulosEquivalentes(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  const corto = a.length <= b.length ? a : b
  const largo = a.length <= b.length ? b : a
  return corto.length >= MIN_CONTENCION && largo.includes(corto)
}

/**
 * Mezcla los eventos estáticos con los de la base de datos eliminando
 * duplicados (misma fecha + títulos equivalentes). Devuelve una lista nueva:
 * estáticos (enriquecidos si tenían duplicado) + los de la base sin pareja.
 */
export function combinarEventos(estaticos, deLaBase) {
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
    if (!pareja) {
      sinPareja.push(evento)
      continue
    }
    const base = resultado[pareja.indice]
    resultado[pareja.indice] = {
      ...base,
      imagen: base.imagen || evento.imagen,
      descripcion: base.descripcion || evento.descripcion,
      hora: base.hora || evento.hora,
      lugar: base.lugar || evento.lugar,
      url: base.url || evento.url,
      entradas: base.entradas || evento.entradas,
      idsSecundarios: [...(base.idsSecundarios || []), evento.id],
    }
  }
  return [...resultado, ...sinPareja]
}
