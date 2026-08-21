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

// Palabras vacías (artículos/preposiciones/conjunciones) que no distinguen un
// evento de otro. Se ignoran al comparar títulos para que un curado y su post
// de Instagram no queden como dos por una palabra de relleno: "Cine de verano:
// UNA película de Minecraft" vs "Cine de verano: película de Minecraft".
const VACIAS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'y', 'e', 'o', 'u', 'en', 'a', 'al', 'con', 'para', 'por',
])

/** Tokens significativos de una clave ya normalizada (sin palabras vacías). */
function significativas(clave) {
  return clave.split(' ').filter((t) => t && !VACIAS.has(t))
}

/** Iguales tras normalizar (ignorando palabras vacías), o uno contenido en el
 * otro si es lo bastante largo — cubre "Cine de verano: Una película de
 * Minecraft" vs "Cine de verano: película de Minecraft" sin fusionar títulos
 * genéricos. */
export function titulosEquivalentes(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  // Misma secuencia de palabras significativas (ignora artículos/preposiciones).
  const sa = significativas(a).join(' ')
  const sb = significativas(b).join(' ')
  if (sa && sa === sb) return true
  const corto = a.length <= b.length ? a : b
  const largo = a.length <= b.length ? b : a
  return corto.length >= MIN_CONTENCION && largo.includes(corto)
}

// Rellena en `base` los campos que tenga vacíos con los de `otro` y acumula el
// id de `otro` en idsSecundarios (para que deep links y destacados que apunten
// al duplicado sigan resolviendo). `base` no se pisa: gana la versión curada o
// el primer duplicado encontrado. Devuelve un objeto nuevo (no muta).
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

/**
 * Procesa el enriquecimiento de carteles deportivos (y otros activos que
 * tengan el campo `enriqueceEvento`). Los carteles que enriquecen a eventos
 * del programa se filtran ANTES de pasar a combinarEventos(), y sus imágenes
 * + datos se inyectan en los eventos correspondientes por ID directo.
 *
 * - Carteles CON enriqueceEvento: se filtran de la lista de retorno
 *   (nunca mostrar como tarjeta independiente) y su imagen se inyecta en
 *   el evento del programa que citan.
 * - Carteles SIN enriqueceEvento: pasan intactos — son eventos nuevos
 *   creados por el scraper, no refieren a nada del programa.
 * - Eventos sin matching: se ignoran con un log (el programa existía cuando
 *   se generó el cartel, ahora no; no debe crashear).
 */
export function enriquecerPorCartel(eventos) {
  const conEnriquecimiento = []
  const sinEnriquecimiento = []

  // Separar carteles que enriquecen de eventos normales
  for (const evt of eventos) {
    if (evt.enriqueceEvento) {
      conEnriquecimiento.push(evt)
    } else {
      sinEnriquecimiento.push(evt)
    }
  }

  if (!conEnriquecimiento.length) {
    return eventos // Nada que enriquecer
  }

  // Mapeo id → [carteles] para lookup rápido
  const cartelPorId = new Map()
  for (const cartel of conEnriquecimiento) {
    const id = cartel.enriqueceEvento
    if (!cartelPorId.has(id)) {
      cartelPorId.set(id, [])
    }
    cartelPorId.get(id).push(cartel)
  }

  // Inyectar imagen + campos del cartel en eventos que coinciden por ID
  const resultado = sinEnriquecimiento.map((evt) => {
    const carteles = cartelPorId.get(evt.id)
    if (!carteles) {
      return evt // Sin cartel que lo enriquezca
    }

    // Usar el primer cartel si hay varios (caso raro)
    const cartel = carteles[0]
    return {
      ...evt,
      // Inyectar imagen y otros campos que el programa no tenga
      imagen: evt.imagen || cartel.imagen,
      descripcion: evt.descripcion || cartel.descripcion,
      hora: evt.hora || cartel.hora,
      lugar: evt.lugar || cartel.lugar,
      url: evt.url || cartel.url,
      // NO sobrescribir: titulo, fecha, categoria, subcategoria, fuente — el programa manda
    }
  })

  return resultado
}

/**
 * Mezcla los eventos estáticos con los de la base de datos eliminando
 * duplicados (misma fecha + títulos equivalentes). Devuelve una lista nueva:
 * estáticos (enriquecidos si tenían duplicado) + los de la base sin pareja,
 * a su vez deduplicados ENTRE SÍ (un mismo acto anunciado en dos posts de
 * Instagram crea dos filas con el mismo título → una sola tarjeta).
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
    // 1) ¿Empareja con un estático? Enriquece ese y sigue.
    const pareja = (porFecha.get(evento.fecha) || []).find((c) =>
      titulosEquivalentes(c.clave, clave)
    )
    if (pareja) {
      resultado[pareja.indice] = fusionar(resultado[pareja.indice], evento)
      continue
    }
    // 2) Si no, ¿ya hay otro de la BD equivalente (misma fecha + título)?
    //    Fusiónalos en vez de crear dos tarjetas.
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
