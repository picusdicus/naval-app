import { createContext, useCallback, useEffect, useMemo, useState } from 'react'

// Imágenes ilustrativas de eventos (GET público): una sola petición compartida
// por toda la app, ver useImagenEvento. El valor es
//   { genericas: [{id, categoria, disciplina, url, autor, fuente, licencia,
//                  descripcion}], asignaciones: {referenciaId: imagenId} }
// Las dos cosas viajan juntas en la misma respuesta del endpoint, porque
// siempre se necesitan a la vez (la asignación manual manda sobre el subtipo).
export const GenericasEventoContext = createContext({ genericas: [], asignaciones: {} })

// Función para recargar tras subir o asignar una imagen desde /admin (el tab
// Eventos y el panel de genéricas): sin ella, las miniaturas no reflejarían el
// cambio hasta recargar la página.
export const RecargarGenericasContext = createContext(() => {})

const VACIO = { imagenes: [], asignaciones: {} }

export function GenericasEventoProvider({ children }) {
  const [datos, setDatos] = useState(VACIO)

  const recargar = useCallback(() => {
    return fetch('/api/imagenes-evento-genericas', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : VACIO))
      .then((d) => setDatos({ imagenes: d.imagenes || [], asignaciones: d.asignaciones || {} }))
      .catch(() => setDatos(VACIO))
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  // Memoizado: sin esto el objeto sería nuevo en cada render y los useMemo que
  // dependen del contexto (uno por tarjeta de la agenda) se recalcularían todos.
  const valor = useMemo(
    () => ({ genericas: datos.imagenes, asignaciones: datos.asignaciones }),
    [datos]
  )

  return (
    <GenericasEventoContext.Provider value={valor}>
      <RecargarGenericasContext.Provider value={recargar}>{children}</RecargarGenericasContext.Provider>
    </GenericasEventoContext.Provider>
  )
}
