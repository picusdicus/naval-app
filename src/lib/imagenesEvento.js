// Imágenes temáticas para los eventos (Wikimedia Commons, licencias libres).
// Cada entrada incluye su crédito para la atribución que exigen las licencias
// CC BY / CC BY-SA; `pos` ajusta el encuadre (object-position) cuando conviene.

export const IMAGENES_EVENTO = {
  fiestas: {
    src: '/img/eventos/fiestas.jpg',
    pos: '50% 25%',
    credito: 'Henry Sattink Rath, CC BY-SA 3.0',
  },
  concierto: {
    src: '/img/eventos/concierto.jpg',
    credito: 'Shixart1985, CC BY 2.0',
  },
  cine: {
    src: '/img/eventos/cine.jpg',
    credito: 'Bdx, CC0',
  },
  teatro: {
    src: '/img/eventos/teatro.jpg',
    credito: 'Tyne & Wear Archives & Museums, sin restricciones',
  },
  gastronomia: {
    src: '/img/eventos/gastronomia.jpg',
    credito: 'Brian Snelson, CC BY 2.0',
  },
  mercado: {
    src: '/img/eventos/mercado.jpg',
    credito: 'Acabashi, CC BY-SA 4.0',
  },
  deporte: {
    src: '/img/eventos/deporte.jpg',
    credito: 'Shixart1985, CC BY 2.0',
  },
  infantil: {
    src: '/img/eventos/infantil.jpg',
    credito: 'Jorge Royan, CC BY-SA 3.0',
  },
}

// Elige la imagen para un evento. Si el evento trae su foto real (campo
// `imagen`, p. ej. el cartel del Ayuntamiento), se usa esa. Si no, se recurre
// a una imagen genérica por categoría; dentro de "cultura" se distingue por el
// título entre concierto, cine y teatro (imagen genérica cultural: teatro).
export function imagenEvento(evento) {
  if (evento.imagen && evento.imagen.trim()) return { src: evento.imagen, real: true }
  return null
}

// Lista de créditos únicos para mostrar en la página de eventos.
export const CREDITOS_FOTOS = [...new Set(Object.values(IMAGENES_EVENTO).map((i) => i.credito))]
