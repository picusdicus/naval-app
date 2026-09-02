import { createContext, useCallback, useEffect, useState } from 'react'

// Imágenes genéricas activas (GET público): una sola petición compartida por
// toda la app, ver useImagenEvento. Valor: array de {id, categoria,
// disciplina, url, autor, fuente, licencia, descripcion}.
export const GenericasEventoContext = createContext([])

// Función para recargar la lista tras subir una genérica desde /admin (el tab
// Eventos y el panel de genéricas): sin ella, las miniaturas de los eventos no
// reflejarían la foto nueva hasta recargar la página.
export const RecargarGenericasContext = createContext(() => {})

export function GenericasEventoProvider({ children }) {
  const [genericas, setGenericas] = useState([])

  const recargar = useCallback(() => {
    return fetch('/api/imagenes-evento-genericas', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { imagenes: [] }))
      .then(({ imagenes }) => setGenericas(imagenes || []))
      .catch(() => setGenericas([]))
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  return (
    <GenericasEventoContext.Provider value={genericas}>
      <RecargarGenericasContext.Provider value={recargar}>{children}</RecargarGenericasContext.Provider>
    </GenericasEventoContext.Provider>
  )
}
