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
export function palabrasSignificativas(clave) {
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
  const sa = palabrasSignificativas(a).join(' ')
  const sb = palabrasSignificativas(b).join(' ')
  if (sa && sa === sb) return true
  const corto = a.length <= b.length ? a : b
  const largo = a.length <= b.length ? b : a
  return corto.length >= MIN_CONTENCION && largo.includes(corto)
}

// ———————————————————————————————————————————————————————————————————————————
// Matcher canónico (fase 1a, ago-2026): las piezas de "¿son el mismo evento?"
// que estaban reimplementadas por separado en tres sitios, consolidadas aquí
// como primitivas + matchers con nombre. NO son una única función universal a
// propósito: las tres situaciones son legítimamente distintas y cada una
// conserva su matcher.
//
// ⚠️ Estado de adopción: en esta fase NADIE llama todavía a las funciones
// nuevas desde producción — cada sitio migra en su propia rama, con su propia
// verificación. Qué función usa (o debería usar) cada sitio:
//
// | Sitio                                    | Matcher                        | Por qué ese |
// |------------------------------------------|--------------------------------|-------------|
// | Agenda pública (combinarEventos, aquí) y | titulosEquivalentes            | Fuentes con títulos "limpios" (curados, extracción de Claude): igualdad normalizada sin palabras vacías, o contención ≥12 chars. Ya canónico — los webhooks lo importan de aquí. |
// | webhooks IG (sync-instagram[-noticias])  |                                | |
// | Cartel deportivo ↔ programa de fiestas   | emparejarCartelConPrograma     | El título del cartel viene del NOMBRE DE FICHERO (ruidoso, con sinónimos "basket"/"baloncesto" y plurales) contra el programa oficial: exige fecha exacta + ≥2 palabras clave con normalización deportiva. Contención simple fallaría. Hoy vive duplicado en api/_actividades-deportes-feed.js (encontrarEventoEnPrograma); migra en la rama 1d. |
// | Cron combinando 5 fuentes                | clavesUnicidadEvento           | Fuentes ya estructuradas donde el mismo item solo puede repetirse literal (mismo feed re-leído, misma url): dedup EXACTO por url o por slug de título+fecha, sin equivalencias difusas — una equivalencia laxa aquí fusionaría actos distintos del programa (158 eventos, muchos títulos parecidos). Hoy vive duplicado en api/sync-events.js (combinarSinDuplicados + claveNorm); migra en la rama 1b. |
//
// Fuera de alcance a propósito: imagen_origen_id (identidad de FOTO, no de
// evento), la generación de ids (`fiestas-<clave>-<fecha>`, `noticias-<clave>`
// — usan slugs propios y cambiarlos rompería ids ya publicados) y la búsqueda
// del directorio (src/lib/busqueda.js, otra pregunta).
//
// ⚠️ Discrepancia latente detectada al consolidar (reportada, NO arreglada
// aquí): claveNormPrograma en api/_actividades-deportes-feed.js reconstruye
// los ids `fiestas-…` con una normalización que NO es la de claveNorm de
// sync-events.js (sin tope de 50, símbolos → '-'): 12 de los 158 títulos del
// programa 2026 divergen. Hoy ninguno de los 8 emparejamientos reales cae en
// ellos; decidir la unificación es de las ramas 1b/1d (ver el comentario en
// el propio feed).
// ———————————————————————————————————————————————————————————————————————————

// —— Primitiva: slug exacto de título (port VERBATIM del claveNorm de
// api/sync-events.js, tope de 50 incluido). No confundir con claveTitulo():
// esta produce un slug con guiones capado a 50 chars (clave de unicidad y de
// ids `fiestas-…`), claveTitulo() produce palabras separadas por espacio sin
// tope (entrada de titulosEquivalentes). Unificarlas cambiaría decisiones en
// títulos >50 chars — decisión para la rama 1b, no de este módulo.
export function claveNormSlug(txt) {
  let slug = String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
  if (slug.length > 50) slug = slug.slice(0, 50).replace(/-+$/, '')
  return slug
}

// —— Primitivas deportivas (port verbatim de api/_actividades-deportes-feed.js).
// Palabras que NATURALMENTE terminan en "s" y no son plurales: nunca se
// recortan a singular ("tenis" no es plural de "teni").
const EXCEPCIONES_PLURALES = new Set([
  'tenis', 'mus', 'las', 'los', 'cms', 'fitness', 'pilates',
])

// Diccionario cerrado de sinónimos deportivos (el cartel dice "basket", el
// programa dice "baloncesto"; "acua"/"aqua" varía por cartel).
const SINONIMOS_DEPORTES = {
  basket: 'baloncesto',
  baloncesto: 'baloncesto',
  acua: 'aqua',
  aqua: 'aqua',
}

/** Palabra en su forma canónica deportiva: sin puntuación final, singular
 * (salvo excepciones) y con sinónimos aplicados. */
export function normalizarPalabraDeportiva(palabra) {
  const p = palabra.toLowerCase().replace(/[.,;:]/g, '')
  let base = p
  if (p.endsWith('s') && p.length > 3 && !EXCEPCIONES_PLURALES.has(p)) {
    base = p.slice(0, -1)
  }
  return SINONIMOS_DEPORTES[base] || SINONIMOS_DEPORTES[p] || base
}

/** Set de palabras clave de un título con la normalización deportiva
 * (minúsculas, sin acentos, solo palabras ≥3 chars, singular+sinónimos). */
export function palabrasClaveDeportivas(txt) {
  return new Set(
    String(txt || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .split(/\s+/)
      .filter((p) => p.length > 2)
      .map(normalizarPalabraDeportiva)
  )
}

/** Cuántas palabras clave deportivas comparten dos títulos. */
export function solapamientoDeportivo(titulo1, titulo2) {
  const palabras1 = palabrasClaveDeportivas(titulo1)
  const palabras2 = palabrasClaveDeportivas(titulo2)
  return [...palabras2].filter((p) => palabras1.has(p)).length
}

// Umbral del matcher deportivo: con 1 palabra compartida ("torneo") medio
// programa emparejaría; 2 ya exige el deporte concreto.
const MIN_PALABRAS_DEPORTE = 2

/**
 * Matcher cartel deportivo ↔ programa oficial (port verbatim de
 * encontrarEventoEnPrograma en api/_actividades-deportes-feed.js): fecha
 * EXACTA + ≥2 palabras clave con normalización deportiva. Devuelve el primer
 * evento del programa que empareja (en el orden del programa — mantener ese
 * orden es parte del contrato: cambiarlo podría cambiar a qué evento
 * enriquece un cartel ambiguo), o null.
 * `cartel`: { titulo, fecha_evento } — sin fecha no hay emparejamiento.
 */
export function emparejarCartelConPrograma(cartel, programa) {
  if (!cartel.fecha_evento || !programa || programa.length === 0) {
    return null
  }
  const eventosMismaFecha = programa.filter((e) => e.fecha === cartel.fecha_evento)
  if (eventosMismaFecha.length === 0) return null
  for (const evento of eventosMismaFecha) {
    if (solapamientoDeportivo(evento.titulo, cartel.titulo) >= MIN_PALABRAS_DEPORTE) {
      return evento
    }
  }
  return null
}

/**
 * Matcher exacto del cron (las claves que usa combinarSinDuplicados en
 * api/sync-events.js): un evento repite si comparte URL con uno ya visto, o
 * si comparte slug de título + fecha. Devuelve las claves para que el
 * llamador gestione su propio Set de vistos (el orden de las listas decide
 * quién sobrevive, y eso es del llamador):
 *   { claveUrl: 'url:…' | null, claveTituloFecha: 'tf:<slug>|<fecha>' }
 * La cadena vacía en `url` desactiva la regla de URL a propósito (ver la
 * sección de actividades deportivas en CLAUDE.md: una url compartida entre
 * carteles se comería todos menos el primero).
 */
export function clavesUnicidadEvento(ev) {
  return {
    claveUrl: ev.url ? `url:${ev.url}` : null,
    claveTituloFecha: `tf:${claveNormSlug(ev.titulo)}|${ev.fecha}`,
  }
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
 * del programa se filtran ANTES de pasar a combinarEventos(), y su IMAGEN
 * (solo la imagen) se inyecta en el evento correspondiente por ID directo.
 *
 * - Carteles CON enriqueceEvento que resuelven: se filtran de la lista de
 *   retorno (nunca mostrar como tarjeta independiente) y su imagen se inyecta
 *   en el evento del programa que citan. El programa manda en todo lo demás.
 * - Carteles CON enriqueceEvento que NO resuelven: se muestran como evento
 *   propio (fail-soft, ver abajo) en vez de desaparecer.
 * - Carteles SIN enriqueceEvento: pasan intactos — son eventos nuevos
 *   creados por el scraper, no refieren a nada del programa.
 *
 * Nota: para que esto funcione, `eventos-externos.json` tiene que CONTENER los
 * carteles emparejados aunque nunca se pinten. No son basura que sobre: son el
 * soporte de la imagen y del marcador. Y cada cartel necesita una `url` propia
 * o el dedup por url del cron se come todos menos el primero (ver
 * api/_actividades-deportes-feed.js).
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

  // Inyectar SOLO la imagen del cartel en el evento que lo cita.
  // El cartel aporta la foto y nada más: el programa es la fuente autorizada
  // para todo lo demás (titulo, fecha, hora, lugar, descripcion, url). Un cartel
  // es un JPG con un título rotulado — sus campos derivados del nombre del
  // fichero son menos fiables que el programa, aunque el programa los tenga vacíos.
  const resultado = sinEnriquecimiento.map((evt) => {
    const carteles = cartelPorId.get(evt.id)
    if (!carteles) {
      return evt // Sin cartel que lo enriquezca
    }

    // Usar el primer cartel si hay varios (caso raro)
    const cartel = carteles[0]
    return {
      ...evt,
      imagen: evt.imagen || cartel.imagen,
    }
  })

  // Fail-soft: un cartel cuyo `enriqueceEvento` no corresponde a ningún evento
  // presente (el programa cambió, el id se generó con otra normalización…) se
  // muestra como evento propio en vez de desaparecer. Perder una tarjeta en
  // silencio es peor que enseñar una de más.
  const idsPresentes = new Set(sinEnriquecimiento.map((e) => e.id))
  const huerfanos = conEnriquecimiento.filter((c) => !idsPresentes.has(c.enriqueceEvento))

  return huerfanos.length ? [...resultado, ...huerfanos] : resultado
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
