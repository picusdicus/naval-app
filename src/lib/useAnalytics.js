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
