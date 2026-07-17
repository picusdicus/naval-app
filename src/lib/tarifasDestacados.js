// Duraciones contratables de un destacado y su tarifa. Módulo deliberadamente
// "limpio" (sin JSX, JSON ni APIs de navegador): lo importan tanto la UI como
// los handlers Edge de api/ — no añadir aquí nada que arrastre dependencias.
// El pago se acuerda fuera de la app; la tarifa es el precio de referencia que
// ve la organización al solicitar y en el detalle de su destacado.

export const PRESETS_DURACION = [7, 15, 30]

// PLACEHOLDER: importes pendientes de confirmar con el negocio.
export const TARIFAS_DESTACADO = { 7: '20 €', 15: '35 €', 30: '60 €' }

/** Tarifa de una duración en días, o null si no es una duración estándar. */
export const tarifaDe = (dias) => TARIFAS_DESTACADO[dias] ?? null
