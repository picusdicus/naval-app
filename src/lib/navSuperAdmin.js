// Vocabulario de navegación del panel de superadmin: qué secciones hay, cómo
// se agrupan y qué contador enseña cada una.
//
// Vive aquí y no dentro de la sidebar porque tiene tres consumidores reales
// (la sidebar de escritorio, el drawer móvil y la barra inferior). Antes había
// tres listas de secciones distintas —GRUPOS en la sidebar, TABS y avisosPorTab
// en el panel— que ya habían empezado a divergir: la barra móvil pintaba sus
// pastillas con un mapa propio que no conocía el tono 'atencion' ni el
// contador informativo.
//
// Módulo "limpio" (sin JSX): es dato, no pintura. Quien lo pinta decide con qué
// forma.

// [clave, icono, etiqueta]. El orden dentro de cada grupo es el de la
// navegación; los grupos se pintan en el orden de GRUPOS.
export const GRUPOS = [
  {
    titulo: null, // "Resumen" no pertenece a ninguna familia: es la portada.
    items: [['resumen', 'dashboard', 'Resumen']],
  },
  {
    titulo: 'Moderación',
    items: [
      ['reclamaciones', 'verified_user', 'Reclamaciones'],
      ['altas', 'add_business', 'Altas'],
      ['pendientes', 'pending_actions', 'Pendientes'],
    ],
  },
  {
    titulo: 'Contenido',
    items: [
      ['eventos', 'event', 'Eventos'],
      ['talleres', 'school', 'Talleres'],
      ['comercios', 'storefront', 'Comercios'],
      ['imagenes', 'image', 'Imágenes genéricas'],
    ],
  },
  {
    titulo: 'Negocio',
    items: [
      ['destacados', 'star', 'Destacados'],
      ['organizaciones', 'business', 'Organizaciones'],
      // Etiqueta completa y no "Códigos": es el nombre que usa el resto del
      // panel (y el que buscan los e2e), y en 248 px cabe de sobra.
      ['codigos', 'card_giftcard', 'Códigos de invitación'],
    ],
  },
  {
    titulo: 'Datos',
    items: [['analytics', 'analytics', 'Analytics']],
  },
]

/**
 * Las cinco de la barra inferior en móvil. No son "las cinco primeras" de
 * GRUPOS: son las que se visitan a diario (las dos colas de moderación con
 * personas esperando al otro lado, y el producto de pago). El resto llega por
 * el drawer, que es la lista completa.
 *
 * `null` como clave = el botón no navega a ninguna sección; abre el drawer.
 */
export const SECCIONES_FRECUENTES = [
  ['resumen', 'dashboard', 'Resumen'],
  ['altas', 'add_business', 'Altas'],
  ['reclamaciones', 'verified_user', 'Reclamaciones'],
  ['destacados', 'star', 'Destacados'],
  [null, 'menu', 'Más'],
]

/**
 * Qué contador enseña cada sección, y con qué peso visual.
 *   'aviso'       — pastilla terracota: hay cola de trabajo sin despachar.
 *   'atencion'    — pastilla dorada: campañas de pago que requieren acción.
 *   'informativo' — número gris: contexto, no una tarea.
 * Devuelve null cuando esa sección no tiene contador (o el suyo falló y vale
 * null): nunca se inventa un 0.
 */
export function contadorDe(clave, resumen) {
  if (!resumen) return null

  const aviso = (valor, texto) =>
    typeof valor === 'number' && valor > 0 ? { valor, tono: 'aviso', texto } : null

  switch (clave) {
    case 'reclamaciones':
      return aviso(resumen.reclamacionesPendientes, 'reclamaciones pendientes')
    case 'altas':
      return aviso(resumen.altasPendientes, 'altas de comercio pendientes')
    case 'pendientes': {
      const n = resumen.pendientesSync
      if (typeof n !== 'number') return null
      return n > 0
        ? { valor: n, tono: 'aviso', texto: 'borradores por revisar' }
        : { valor: 0, tono: 'informativo', texto: 'borradores por revisar' }
    }
    case 'destacados': {
      const n = resumen.destacadosRequierenAccion
      return typeof n === 'number' && n > 0
        ? { valor: n, tono: 'atencion', texto: 'destacados requieren acción' }
        : null
    }
    // Mientras haya propuestas de reimportación, el contador de Talleres es
    // esa cola; sin ellas no hay número informativo que enseñar (el resumen
    // no cuenta talleres, y el total del catálogo tampoco sería una tarea).
    case 'talleres':
      return aviso(resumen.propuestasTalleres, 'actualizaciones de talleres propuestas')
    case 'organizaciones':
      return typeof resumen.organizacionesActivas === 'number'
        ? { valor: resumen.organizacionesActivas, tono: 'informativo', texto: 'organizaciones activas' }
        : null
    case 'eventos':
      return typeof resumen.eventosPublicados === 'number'
        ? { valor: resumen.eventosPublicados, tono: 'informativo', texto: 'eventos publicados' }
        : null
    default:
      return null
  }
}

/** ¿Este contador representa trabajo pendiente (y no solo contexto)? */
export function esTarea(contador) {
  return Boolean(contador) && contador.tono !== 'informativo'
}

/**
 * Suma de todo lo que espera al superadmin, para el badge de la campana.
 * Recorre GRUPOS en vez de leer campos del resumen a mano: así una sección
 * nueva con contador entra en la cuenta sin tocar esta función.
 */
export function totalPendiente(resumen) {
  if (!resumen) return 0
  return GRUPOS.flatMap((grupo) => grupo.items).reduce((suma, [clave]) => {
    const contador = contadorDe(clave, resumen)
    return esTarea(contador) ? suma + contador.valor : suma
  }, 0)
}
