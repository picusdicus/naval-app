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

// Segundo intento SOLO para eventos del Ayuntamiento: el mismo acto llega con
// títulos redactados distinto en el programa de fiestas y en Instagram
// ("TROFEO FIESTAS PATRONALES CD FUTSI NAVALCARNERO." vs "Trofeo fiestas
// patronales futbol sala") y titulosEquivalentes no los reconoce. Este matcher
// es más permisivo y por eso solo se aplica tras fallar el canónico y solo si
// el evento de Neon pertenece a la organización con este slug — para cualquier
// otra org o club el comportamiento de la agenda no cambia.
export const SLUG_AYUNTAMIENTO = 'ayuntamiento'

// Siglas/palabras de entidad de club que no identifican el acto: "CD FUTSI
// NAVALCARNERO" y "Futsi Atlético Navalcarnero" son el mismo club con y sin
// la sigla. Solo se ignoran en el matcher aproximado, nunca en el canónico.
const ENTIDAD_CLUB = new Set(['cd', 'club'])

// Umbral absoluto: con 1 sola palabra compartida ("torneo", "novena") medio
// programa emparejaría; 2 ya exige algo propio del acto.
const MIN_PALABRAS_APROX = 2

// "tenis DE MESA" no es "tenis": una palabra compartida seguida de una de
// estas preposiciones y una palabra NO compartida forma un compuesto que
// nombra otra disciplina/acto, y veta la fusión aunque el solapamiento sea
// alto. "voleibol villa" (yuxtaposición, sin preposición) no dispara el veto.
const PREPOSICIONES_COMPUESTO = new Set(['de', 'del', 'sobre'])

function palabrasAprox(clave) {
  return palabrasSignificativas(clave).filter((p) => !ENTIDAD_CLUB.has(p))
}

// ¿Alguna palabra compartida va seguida (salvo palabras vacías) de una
// preposición de compuesto + una palabra que el otro título NO tiene?
function compuestoDivergente(clave, compartidas) {
  const tokens = clave.split(' ')
  for (let i = 0; i < tokens.length - 1; i++) {
    if (!compartidas.has(tokens[i])) continue
    if (!PREPOSICIONES_COMPUESTO.has(tokens[i + 1])) continue
    let j = i + 2
    while (j < tokens.length && VACIAS.has(tokens[j])) j++
    if (j < tokens.length && !ENTIDAD_CLUB.has(tokens[j]) && !compartidas.has(tokens[j])) {
      return true
    }
  }
  return false
}

/**
 * Matcher aproximado (solo Ayuntamiento, ver SLUG_AYUNTAMIENTO): recibe dos
 * claves de claveTitulo() y devuelve true si la MAYORÍA ESTRICTA de las
 * palabras significativas del título más corto (ignorando siglas de club)
 * aparece en el más largo, con al menos MIN_PALABRAS_APROX compartidas y sin
 * compuestos divergentes en ninguno de los dos. El umbral proporcional es
 * deliberado (no un nº fijo como en el matcher deportivo): un título corto
 * exige compartir casi todo, uno largo tolera más relleno.
 */
export function titulosAproximados(a, b) {
  if (!a || !b) return false
  const pa = new Set(palabrasAprox(a))
  const pb = new Set(palabrasAprox(b))
  if (!pa.size || !pb.size) return false
  const compartidas = new Set([...pa].filter((p) => pb.has(p)))
  if (compartidas.size < MIN_PALABRAS_APROX) return false
  const corto = Math.min(pa.size, pb.size)
  if (compartidas.size * 2 <= corto) return false
  if (compuestoDivergente(a, compartidas) || compuestoDivergente(b, compartidas)) return false
  return true
}

// ———————————————————————————————————————————————————————————————————————————
// Matcher canónico (fase 1a, ago-2026): las piezas de "¿son el mismo evento?"
// que estaban reimplementadas por separado en tres sitios, consolidadas aquí
// como primitivas + matchers con nombre. NO son una única función universal a
// propósito: las tres situaciones son legítimamente distintas y cada una
// conserva su matcher.
//
// Estado de adopción: las tres migraciones están hechas (1b cron 2026-08-24,
// 1c webhooks IG auditada sin cambio de código 2026-08-24, 1d feed de
// deportes 2026-08-24) — todos los sitios de producción importan de aquí.
// Qué función usa cada sitio:
//
// | Sitio                                    | Matcher                        | Por qué ese |
// |------------------------------------------|--------------------------------|-------------|
// | Agenda pública (combinarEventos, aquí) y | titulosEquivalentes            | Fuentes con títulos "limpios" (curados, extracción de Claude): igualdad normalizada sin palabras vacías, o contención ≥12 chars. Ya canónico — los webhooks lo importan de aquí. |
// | webhooks IG (sync-instagram[-noticias])  |                                | |
// | Cartel deportivo ↔ programa de fiestas   | emparejarCartelConPrograma     | El título del cartel viene del NOMBRE DE FICHERO (ruidoso, con sinónimos "basket"/"baloncesto" y plurales) contra el programa oficial: exige fecha exacta + ≥2 palabras clave con normalización deportiva. Contención simple fallaría. Migrado (rama 1d, 2026-08-24): api/_actividades-deportes-feed.js importa este matcher (y claveNormSlug para reconstruir los ids `fiestas-…`). |
// | Cron combinando 5 fuentes                | clavesUnicidadEvento           | Fuentes ya estructuradas donde el mismo item solo puede repetirse literal (mismo feed re-leído, misma url): dedup EXACTO por url o por slug de título+fecha, sin equivalencias difusas — una equivalencia laxa aquí fusionaría actos distintos del programa (158 eventos, muchos títulos parecidos). Migrado (rama 1b, 2026-08-24): combinarSinDuplicados en api/sync-events.js importa clavesUnicidadEvento de aquí, y los ids `fiestas-…` usan claveNormSlug. |
//
// Fuera de alcance a propósito: imagen_origen_id (identidad de FOTO, no de
// evento), la generación de ids (`fiestas-<clave>-<fecha>`, `noticias-<clave>`
// — usan slugs propios y cambiarlos rompería ids ya publicados) y la búsqueda
// del directorio (src/lib/busqueda.js, otra pregunta).
//
// La discrepancia de ids detectada al consolidar (la claveNormPrograma local
// del feed de deportes divergía de claveNorm del cron en 12 de 158 títulos
// del programa 2026) quedó RESUELTA en la rama 1d: el feed reconstruye los
// ids `fiestas-…` con la misma claveNormSlug de aquí que usa eventosFiestas()
// en sync-events.js, verificado título a título sobre los 158 (y sin ninguna
// referencia a los 12 ids viejos ni en el repo ni en Neon).
// ———————————————————————————————————————————————————————————————————————————

// —— Primitiva: slug exacto de título (port VERBATIM del claveNorm que vivía
// en api/sync-events.js, tope de 50 incluido — desde la rama 1b el cron
// importa esta). No confundir con claveTitulo(): esta produce un slug con
// guiones capado a 50 chars (clave de unicidad y de ids `fiestas-…`),
// claveTitulo() produce palabras separadas por espacio sin tope (entrada de
// titulosEquivalentes). Unificarlas cambiaría decisiones en títulos >50 chars
// — la rama 1b las mantuvo separadas a propósito.
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
 * Matcher cartel deportivo ↔ programa oficial (lo usa
 * api/_actividades-deportes-feed.js desde la rama 1d): fecha
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

// ———————————————————————————————————————————————————————————————————————————
// Fuente de ingesta — SOLO para el tab Eventos del panel superadmin. La agenda
// pública no pinta esta etiqueta en ningún sitio.
//
// La identidad de la vía de entrada es el prefijo del "id de ingesta": para un
// evento estático, su propio id del JSON (los genera sync-events.js /
// _actividades-deportes-feed.js); para uno de Neon (id `bd-…`), su
// origen_externo_id (`ig-…` de los webhooks de Instagram; NULL = creado a mano
// desde /panel). Los curados de eventos.json (`ev-…`, `vive25-…`) no llevan
// etiqueta a propósito: no vienen de ninguna tubería de ingesta.
// ———————————————————————————————————————————————————————————————————————————

const ETIQUETAS_FUENTE = [
  ['fiestas-', 'Programa oficial'],
  ['deportes-', 'Galería de Deportes'],
  ['redteatros-', 'Red de Teatros'],
  ['tyltyl-', 'Teatro TYL TYL'],
  ['aytocult-', 'Web municipal (cultura)'],
  ['ig-', 'Instagram'],
]

function etiquetaDePrefijo(id) {
  if (!id) return null
  const entrada = ETIQUETAS_FUENTE.find(([prefijo]) => String(id).startsWith(prefijo))
  return entrada ? entrada[1] : null
}

// Etiqueta de una fila de Neon por su origen_externo_id. Un prefijo
// desconocido devuelve null (mejor sin etiqueta que una equivocada).
function etiquetaDeNeon(origenExternoId) {
  if (!origenExternoId) return 'Organización'
  return etiquetaDePrefijo(origenExternoId)
}

/**
 * Etiqueta legible de la vía por la que un evento entró en la agenda, o null
 * si no tiene (curados a mano, prefijos desconocidos). Para un evento
 * fusionado por título aproximado devuelve las dos fuentes ("Programa
 * oficial + Instagram"): la del estático base y la de la fila de Neon que
 * aportó la fusión (origenExternoIdFusionado, ver combinarEventos).
 */
export function fuenteDeIngesta(evento) {
  const principal = String(evento.id || '').startsWith('bd-')
    ? etiquetaDeNeon(evento.origenExternoId)
    : etiquetaDePrefijo(evento.id)
  if (!evento.fusionadoPorTituloAproximado) return principal
  const secundaria = etiquetaDeNeon(evento.origenExternoIdFusionado)
  if (!secundaria || secundaria === principal) return principal
  return principal ? `${principal} + ${secundaria}` : secundaria
}

/**
 * ¿La imagen de este evento es un cartel con el texto rotulado (título, fecha
 * y lugar dibujados como parte del diseño del JPG)? Verificado sobre los
 * carteles reales publicados (ago-2026): TODAS las imágenes de los posts de
 * Instagram del Ayuntamiento y de la galería de Deportes de WordPress siguen
 * esa plantilla. La tarjeta usa esta marca para no volver a pintar su título
 * encima (lo oculta solo visualmente; sigue en el DOM para lectores de
 * pantalla). En las fusiones la procedencia del campo `imagen` deja de ser
 * deducible del propio evento, así que fusionar() y enriquecerPorCartel()
 * dejan la marca `imagenRotulada` en el momento en que aún se conoce.
 */
export function imagenConTextoRotulado(evento) {
  if (!evento?.imagen) return false
  if (evento.imagenRotulada) return true
  return evento.organizacionSlug === SLUG_AYUNTAMIENTO || evento.origen === 'deportes'
}

// Rellena en `base` los campos que tenga vacíos con los de `otro` y acumula el
// id de `otro` en idsSecundarios (para que deep links y destacados que apunten
// al duplicado sigan resolviendo). `base` no se pisa: gana la versión curada o
// el primer duplicado encontrado. Devuelve un objeto nuevo (no muta).
function fusionar(base, otro) {
  // Quién aporta la imagen decide si lleva texto rotulado: el resultado hereda
  // la identidad del estático base y perdería la procedencia de la foto.
  const aportaImagen = base.imagen ? base : otro.imagen ? otro : null
  return {
    ...base,
    imagen: base.imagen || otro.imagen,
    imagenRotulada: aportaImagen ? imagenConTextoRotulado(aportaImagen) : false,
    descripcion: base.descripcion || otro.descripcion,
    hora: base.hora || otro.hora,
    lugar: base.lugar || otro.lugar,
    url: base.url || otro.url,
    entradas: base.entradas || otro.entradas,
    subcategoria: base.subcategoria || otro.subcategoria,
    organizacionId: base.organizacionId || otro.organizacionId,
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
      // La foto inyectada ES el cartel rotulado de la galería de Deportes; el
      // evento del programa que la recibe no lo sabría por sí mismo.
      imagenRotulada: evt.imagen ? imagenConTextoRotulado(evt) : Boolean(cartel.imagen),
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
 * Aplica las fusiones manuales del superadmin (tabla `fusiones_eventos`,
 * issue #27) como ÚLTIMO paso del merge, después de combinarEventos(): son
 * pares que el matcher automático no une ("Duatlón" vs "Duatlón
 * Padres/Hijos.") y que una persona decidió que son el mismo acto. Aplicarlas
 * al final no perturba ninguna decisión del matcher, y si algún día el
 * matcher aprende a unir el par solo, la fila se vuelve un no-op inofensivo.
 *
 * `fusiones`: [{principal, secundaria}] con ids públicos (los mismos que usan
 * eventos_ocultos y destacados). El principal sobrevive como base y la
 * secundaria solo rellena sus campos vacíos (misma semántica fusionar() que
 * las fusiones automáticas); su id — y los idsSecundarios que ella hubiera
 * acumulado — pasan a idsSecundarios del principal, así deep links,
 * destacados, ocultos y avisos que apunten a la secundaria siguen
 * resolviendo. Ambas partes se buscan por id principal O por idsSecundarios
 * (una de ellas puede haber sido ya absorbida en otra tarjeta por el matcher).
 *
 * Fusión inerte: si falta cualquiera de las dos partes (la fuente dejó de
 * traerla, o su id cambió al retitularse), la fila es un no-op silencioso — y
 * se reactiva sola si la parte vuelve. `estado` (opcional, para el panel
 * superadmin) recibe en `estado.inertes` esas filas con su `motivo`.
 */
export function aplicarFusionesManuales(eventos, fusiones, estado = null) {
  if (!fusiones || !fusiones.length) return eventos
  if (estado && !estado.inertes) estado.inertes = []

  const indicePorRef = new Map()
  eventos.forEach((evento, i) => {
    if (!indicePorRef.has(evento.id)) indicePorRef.set(evento.id, i)
    for (const sec of evento.idsSecundarios || []) {
      if (!indicePorRef.has(sec)) indicePorRef.set(sec, i)
    }
  })

  const absorbidos = new Set()
  const copia = [...eventos]
  for (const fusion of fusiones) {
    const iPrincipal = indicePorRef.get(fusion.principal)
    const iSecundaria = indicePorRef.get(fusion.secundaria)
    if (iPrincipal == null || iSecundaria == null) {
      if (estado) {
        estado.inertes.push({
          ...fusion,
          motivo:
            iPrincipal == null && iSecundaria == null
              ? 'no se encuentra ninguna de las dos partes'
              : iPrincipal == null
                ? `no se encuentra el principal (${fusion.principal})`
                : `no se encuentra el secundario (${fusion.secundaria})`,
        })
      }
      continue
    }
    // Ya son la misma tarjeta (el matcher los unió, o una fusión anterior de
    // esta misma lista), o una de las partes ya fue absorbida: nada que hacer.
    if (iPrincipal === iSecundaria || absorbidos.has(iSecundaria) || absorbidos.has(iPrincipal)) {
      continue
    }
    const principal = copia[iPrincipal]
    const secundaria = copia[iSecundaria]
    const fusionado = fusionar(principal, secundaria)
    copia[iPrincipal] = {
      ...fusionado,
      // fusionar() solo acumula el id directo de `otro`; los secundarios que
      // la tarjeta absorbida hubiera acumulado también deben seguir resolviendo.
      idsSecundarios: [
        ...new Set([...(fusionado.idsSecundarios || []), ...(secundaria.idsSecundarios || [])]),
      ],
      fusionadoManualmente: true,
      // Para el panel: qué filas de fusiones_eventos sostienen esta tarjeta
      // (el botón "Deshacer" borra una fila concreta). La agenda pública
      // ignora el campo.
      fusionesManualesAplicadas: [
        ...(principal.fusionesManualesAplicadas || []),
        { principal: fusion.principal, secundaria: fusion.secundaria },
      ],
    }
    absorbidos.add(iSecundaria)
  }

  if (!absorbidos.size) return eventos
  return copia.filter((_, i) => !absorbidos.has(i))
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
    // 1b) Segundo intento, SOLO para eventos de la organización Ayuntamiento
    //     de Navalcarnero (organizacionSlug del JOIN de /api/eventos): el
    //     programa de fiestas y el post de Instagram redactan el mismo acto
    //     con títulos distintos. Primer candidato en el orden de la lista
    //     estática, misma convención que emparejarCartelConPrograma. La
    //     fusión queda marcada para que el superadmin pueda revisarla en el
    //     tab Eventos (la agenda pública no muestra la marca).
    if (evento.organizacionSlug === SLUG_AYUNTAMIENTO) {
      const aproximada = (porFecha.get(evento.fecha) || []).find((c) =>
        titulosAproximados(c.clave, clave)
      )
      if (aproximada) {
        resultado[aproximada.indice] = {
          ...fusionar(resultado[aproximada.indice], evento),
          fusionadoPorTituloAproximado: true,
          // Origen de la fila de Neon que aportó la fusión (fusionar() solo
          // conserva su id en idsSecundarios): fuenteDeIngesta lo necesita
          // para etiquetar las DOS fuentes en el tab Eventos de /admin.
          origenExternoIdFusionado: evento.origenExternoId ?? null,
        }
        continue
      }
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
