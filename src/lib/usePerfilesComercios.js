import { useCallback, useEffect, useState } from 'react'

// Perfiles enriquecidos de los comercios reclamados (foto, descripción, contacto).
// Una sola petición a /api/comercios-perfiles (respuesta cacheada en CDN) en vez
// de una por comercio: el listado necesita los de la categoría entera para pintar
// foto y sello "verificado", y eran cientos de fetches por visita.
//
// Falla en silencio: sin perfiles el listado se pinta igual con los datos del JSON.
export function usePerfilesComercios() {
  const [perfiles, setPerfiles] = useState({})
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    fetch('/api/comercios-perfiles')
      .then((res) => (res.ok ? res.json() : { perfiles: {} }))
      .then((datos) => {
        if (vivo) setPerfiles(datos.perfiles || {})
      })
      .catch((err) => console.warn('No se pudieron cargar los perfiles de comercios:', err))
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  const obtenerPerfil = useCallback((id) => perfiles[id] || null, [perfiles])

  return { perfiles, cargando, obtenerPerfil }
}
