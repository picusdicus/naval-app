// Adaptadores de eventos y comercios a las props de <TarjetaDestacado>.
// La lista de qué está destacado vive en Neon (tabla `destacados`) y llega
// cruda por /api/destacados; aquí se resuelve cada referencia contra los
// datos que el cliente ya tiene y se normaliza a una única forma de tarjeta:
//
//   { id, tipo, to, titulo, badge, imagen, imagenPos, colorCategoria,
//     simbolo, lineas: [{ icono, texto }], item }
//
// Prioridad de imagen: la del destacado (imagen_url contratada) > la propia
// del evento (imagenEvento) > sin imagen (la tarjeta pinta el color de
// categoría con el símbolo grande, como el hero de Eventos).

import comerciosData from '../data/comercios.json'
import serviciosLocales from '../data/servicios-locales.json'
import { diasHasta, UMBRAL_AVISO_CADUCIDAD } from './fechas.js'
import { CATEGORIAS_EVENTO, formatearFechaCorta } from './eventos.js'
import { imagenEvento } from './imagenesEvento.js'
import { CATEGORIAS } from './categorias.js'
import { SIMBOLO_EVENTO } from '../components/eventos/iconosEvento.jsx'
import { SIMBOLO_CATEGORIA } from '../components/directorio/iconosCategoria.jsx'

// Índice de todo el directorio por id ('gpl_…' y 'local/…'), a nivel de
// módulo: los JSON son estáticos, no hay que reconstruirlo por render.
export const COMERCIOS_POR_ID = new Map(
  [...comerciosData, ...serviciosLocales].map((c) => [c.id, c]),
)

// Días que le quedan a una campaña activa y en vigor que caduca pronto
// (0..UMBRAL_AVISO_CADUCIDAD), o null si no procede avisar. Única fuente del
// aviso "caduca en N días" para la tabla del superadmin y el panel de la org.
// Exige `vigente`, así que es excluyente con "fuera de plazo" por construcción.
export function diasParaCaducar(destacado) {
  if (destacado?.estado !== 'activo' || !destacado.vigente || !destacado.fechaFin) return null
  const dias = diasHasta(destacado.fechaFin)
  return dias >= 0 && dias <= UMBRAL_AVISO_CADUCIDAD ? dias : null
}

export function textoCaducidad(dias) {
  if (dias === 0) return 'caduca hoy'
  if (dias === 1) return 'caduca mañana'
  return `caduca en ${dias} días`
}

// Campaña activa cuyo plazo ya pasó. No basta con `!vigente`: un activo puede
// no estar en vigor también porque su fecha_inicio aún no ha llegado.
export function campanaFinalizada(destacado) {
  return (
    destacado?.estado === 'activo' &&
    !destacado.vigente &&
    Boolean(destacado.fechaFin) &&
    diasHasta(destacado.fechaFin) < 0
  )
}

export function eventoATarjeta(evento, imagenOverride) {
  const propia = imagenEvento(evento)
  return {
    id: `evento-${evento.id}`,
    tipo: 'evento',
    to: `/eventos/${evento.id}`,
    titulo: evento.titulo,
    badge: CATEGORIAS_EVENTO[evento.categoria]?.nombre || 'Evento',
    imagen: imagenOverride || propia?.src || '',
    imagenPos: imagenOverride ? undefined : propia?.pos,
    colorCategoria: CATEGORIAS_EVENTO[evento.categoria]?.color,
    simbolo: SIMBOLO_EVENTO[evento.categoria] || 'event',
    lineas: [
      {
        icono: 'calendar_today',
        texto: `${formatearFechaCorta(evento.fecha)}${evento.hora ? `, ${evento.hora}` : ''}`,
      },
      ...(evento.lugar ? [{ icono: 'location_on', texto: evento.lugar }] : []),
    ],
    item: evento,
  }
}

export function comercioATarjeta(comercio, imagenOverride) {
  const categoria = CATEGORIAS[comercio.categoria]
  return {
    id: `comercio-${comercio.id}`,
    tipo: 'comercio',
    to: `/comercios?comercio=${encodeURIComponent(comercio.id)}`,
    titulo: comercio.nombre,
    badge: categoria?.nombre || 'Comercio',
    imagen: imagenOverride || '',
    imagenPos: undefined,
    colorCategoria: categoria?.color,
    simbolo: SIMBOLO_CATEGORIA[comercio.categoria] || 'location_on',
    lineas: [
      {
        icono: SIMBOLO_CATEGORIA[comercio.categoria] || 'storefront',
        texto: comercio.tipoDisplay || comercio.subtipo || categoria?.nombre || '',
      },
      ...(comercio.rating ? [{ icono: 'star', texto: `${comercio.rating}` }] : []),
    ],
    item: comercio,
  }
}
