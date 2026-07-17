// Hook para reportar eventos anónimos de análisis a la API.
// No requiere identificación del usuario.
export function reportarAnalytics(tipoEvento, datos = {}) {
  navigator.sendBeacon('/api/analytics/track', JSON.stringify({
    tipoEvento,
    ...datos,
  }))
}

export function reportarVisita(seccion) {
  reportarAnalytics('visita', { seccion })
}

export function reportarPreguntaAsistente(pregunta) {
  reportarAnalytics('pregunta_asistente', { preguntaAsistente: pregunta })
}

export function reportarBusquedaComercio(comercio) {
  reportarAnalytics('busqueda_comercio', { comercioBuscado: comercio })
}

// Visita al detalle de un evento publicado desde el panel (id de Neon, sin el
// prefijo 'bd-'). Alimenta la pestaña "Mis analíticas" de su organización.
export function reportarVisitaEvento(eventoId, organizacionId) {
  reportarAnalytics('visita_evento', { eventoId, organizacionId })
}

// Clic en una tarjeta destacada (producto de pago) y desde qué superficie
// ('inicio' | 'eventos' | 'comercios'). Reutiliza columnas existentes:
// evento_id/organizacion_id para eventos creados en la app (referencia
// 'bd-<uuid>'), comercio_buscado para comercios; los eventos estáticos solo
// registran el clic con su superficie. `destacado` es la tarjeta de los
// adaptadores de src/lib/destacados.js (lleva `tipo` e `item`).
export function reportarClicDestacado(destacado, seccion) {
  const datos = { seccion }
  const item = destacado.item
  if (destacado.tipo === 'evento' && typeof item?.id === 'string' && item.id.startsWith('bd-')) {
    datos.eventoId = item.id.slice(3)
    if (item.organizacionId) datos.organizacionId = item.organizacionId
  }
  if (destacado.tipo === 'comercio' && item?.id) {
    datos.comercioBuscado = item.id
  }
  reportarAnalytics('clic_destacado', datos)
}
