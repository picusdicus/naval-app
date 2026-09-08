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
import { diasHasta, duracionDe, UMBRAL_AVISO_CADUCIDAD } from './fechas.js'
import { CATEGORIAS_EVENTO, formatearFechaCorta } from './eventos.js'
import { colorCategoriaTaller, nombreCategoriaTaller, tallerComoEvento, textoTurno } from './talleres.js'
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

/**
 * Porcentaje de campaña ya consumido, 0..100, para la barra de vigencia.
 * La comparten los dos sitios donde el superadmin ve una campaña correr: los
 * "Destacados en curso" del Resumen y las tarjetas del tab Destacados. Vive
 * aquí para que ambas barras midan lo mismo — dos copias con criterios de
 * redondeo distintos darían porcentajes que no cuadran entre pantallas.
 */
export function porcentajeTranscurrido(fechaInicio, fechaFin) {
  const total = duracionDe(fechaInicio, fechaFin)
  if (!(total > 0)) return 100
  // duracionDe cuenta los dos extremos: el primer día de una campaña ya lleva
  // 1 día consumido, no 0.
  const transcurridos = total - diasHasta(fechaFin)
  return Math.max(0, Math.min(100, Math.round((transcurridos / total) * 100)))
}

/**
 * Tarjeta de carrusel para un evento.
 *  - `imagenOverride`: la imagen contratada del destacado (destacados.imagen_url),
 *    que gana sobre cualquier otra.
 *  - `genericas`: imágenes genéricas de Neon YA filtradas por categoría y
 *    disciplina del evento (ver useImagenEvento); se pasan a imagenEvento().
 */
export function eventoATarjeta(evento, { imagenOverride, genericas = [] } = {}) {
  const propia = imagenEvento(evento, { genericas })
  // Reserva por si la imagen principal falla al cargar (cartel externo que ya
  // no existe): la ilustrativa que le tocaría sin foto propia.
  const reserva = propia?.real ? imagenEvento({ ...evento, imagen: '' }, { genericas }) : null
  return {
    id: `evento-${evento.id}`,
    tipo: 'evento',
    to: `/eventos/${evento.id}`,
    titulo: evento.titulo,
    badge: CATEGORIAS_EVENTO[evento.categoria]?.nombre || 'Evento',
    imagen: imagenOverride || propia?.src || '',
    imagenPos: imagenOverride ? undefined : propia?.pos,
    imagenReserva: reserva?.src || '',
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

/**
 * Tarjeta de carrusel para un taller municipal.
 *
 * Gemelo de eventoATarjeta: mismas claves, para que <TarjetaDestacado> y
 * <CarruselDestacados> no tengan que saber de qué tipo es el item. La imagen
 * sigue la misma prioridad (contratada > propia > ilustrativa de #23), pasando
 * el taller por tallerComoEvento() para no duplicar nada de imagenesEvento.js.
 *
 * A diferencia de un evento no hay fecha que pintar: la primera línea es el
 * primer turno ("Martes y jueves · 10:00-11:00"), que es el dato por el que un
 * vecino decide si le encaja.
 */
export function tallerATarjeta(taller, { imagenOverride, genericas = [] } = {}) {
  const comoEvento = tallerComoEvento(taller)
  const propia = imagenEvento(comoEvento, { genericas })
  const reserva = propia?.real
    ? imagenEvento({ ...comoEvento, imagen: '' }, { genericas })
    : null
  const primerTurno = taller.turnos?.[0]

  return {
    id: `taller-${taller.id}`,
    tipo: 'taller',
    to: `/talleres/${taller.id}`,
    titulo: taller.nombre,
    badge: nombreCategoriaTaller(taller.categoria),
    imagen: imagenOverride || propia?.src || '',
    imagenPos: imagenOverride ? undefined : propia?.pos,
    imagenReserva: reserva?.src || '',
    colorCategoria: colorCategoriaTaller(taller.categoria),
    simbolo: 'school',
    lineas: [
      ...(primerTurno ? [{ icono: 'schedule', texto: textoTurno(primerTurno) }] : []),
      ...(taller.lugar ? [{ icono: 'location_on', texto: taller.lugar }] : []),
    ],
    item: taller,
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
