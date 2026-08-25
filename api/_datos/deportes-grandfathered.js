// Lista de exclusión (grandfathering) de la rama feat/deportes-nuevos-a-revision:
// los 36 origen_externo_id de carteles deportivos presentes en el
// eventos-externos.json committeado el 2026-08-25. Cualquier id de esta lista
// sigue para siempre en la tubería del JSON (publicado directo), empareje o no
// con el programa de fiestas; solo un id que NUNCA haya estado en el JSON entra
// por el camino nuevo de revisión humana (tabla actividades, estado borrador).
//
// Es una propiedad del ID, no del estado de matching: incluye también los 8
// emparejados de hoy para que uno que deje de emparejar mañana no se mueva a
// Neon retroactivamente (caería al fail-soft de siempre: tarjeta propia).
// Limitación conocida y aceptada: los ids sin componente de fecha
// (deportes-plazo-*, fallbacks sin número) pueden regenerarse idénticos en una
// temporada futura y se darían por grandfathered, saltándose la revisión.
// NO añadir ids nuevos aquí: la lista es una foto histórica, no un registro vivo.

export const DEPORTES_GRANDFATHERED = new Set([
  // 28 sin emparejar (publicados directos en el JSON de la fecha de corte)
  'deportes-39-iv-torofeo-fs-navalcarnero',
  'deportes-38-carrera-del-galgos',
  'deportes-36-torneo-baloncesto-partido',
  'deportes-35-trio-al-plato',
  'deportes-33-homenaje-futsi',
  'deportes-31-trofeo-cd-futsi',
  'deportes-30-memorial-angel-carrizo',
  'deportes-27-exhibicion-jumping-fitnes',
  'deportes-26-puertas-abiertas-patinaje',
  'deportes-25-torneo-voleibol',
  'deportes-23-juegos-populares-chito-y-rana',
  'deportes-20-waterpolo-y-aquazumba',
  'deportes-18-torneo-benefico-futbol-birras',
  'deportes-14-juegos-populares-calva-y-bolo-cantabro',
  'deportes-11-exhibicion-escuela-artes-marciales',
  'deportes-10-juegos-populares-para-nios-relevos-etc',
  'deportes-7maser-class-zumbadance-y-pilates',
  'deportes-6-yincana-juegos-alternativos-para-familias',
  'deportes-4-master-class-body-combay',
  'deportes-3-marcha-cicloturisma',
  'deportes-2-tardeo-deportivo',
  'deportes-plazo-tenis-de-mesa',
  'deportes-plazo-torneo-de-padel',
  'deportes-22-natacion-30-agosto',
  'deportes-plazo-petanca',
  'deportes-plazo-duatln',
  'deportes-plazo-aquatln-2-sept',
  'deportes-plazo-puerta-abiertas-rugby-3-sept',
  // 8 emparejados con el programa de fiestas en la fecha de corte
  'deportes-5-torneo-futbol-7-infantil-25-agosto',
  'deportes-9-torneo-de-futbol-senior-y-veteranos-del-27-de-agosto-al-5-de-sept',
  'deportes-8-torneo-de-tenis-del-27-de-agosto-al-5-de-sept',
  'deportes-16-torneo-basket-28-agosto',
  'deportes-15-juegos-deportivos-para-nios-28-agosto',
  'deportes-17-prueba-de-velocidad-29-agosto',
  'deportes-28-competicion-calistenia-2-sept',
  'deportes-34-torneo-ajedrez-5-sept',
])
