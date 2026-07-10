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
