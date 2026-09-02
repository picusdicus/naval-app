import { createContext, useState, useEffect } from 'react'

export const GenericasEventoContext = createContext([])

export function GenericasEventoProvider({ children }) {
  const [genericas, setGenericas] = useState([])

  useEffect(() => {
    fetch('/api/imagenes-evento-genericas')
      .then((r) => (r.ok ? r.json() : { imagenes: [] }))
      .then(({ imagenes }) => setGenericas(imagenes || []))
      .catch(() => setGenericas([]))
  }, [])

  return (
    <GenericasEventoContext.Provider value={genericas}>
      {children}
    </GenericasEventoContext.Provider>
  )
}
