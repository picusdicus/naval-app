import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// Estado de sesión del panel /admin. El JWT vive en una cookie httpOnly, así
// que el navegador no puede leerlo: preguntamos al servidor quiénes somos.
const ContextoAdmin = createContext(null)

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export function useAdminAuth() {
  const contexto = useContext(ContextoAdmin)
  if (!contexto) throw new Error('useAdminAuth debe usarse dentro de <AdminAuthProvider>')
  return contexto
}

export function AdminAuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  // Arrancamos cargando: hasta confirmar la sesión no sabemos si redirigir.
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true

    fetch('/api/admin/sesion')
      .then((r) => (r.ok ? r.json() : null))
      .then((datos) => {
        if (vigente) setUsuario(datos?.usuario ?? null)
      })
      .catch(() => {
        if (vigente) setUsuario(null)
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [])

  const iniciarSesion = useCallback(async (email, password, endpoint = '/api/login') => {
    const respuesta = await fetch(endpoint, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email, password }),
    })
    const datos = await respuesta.json().catch(() => ({}))
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudo iniciar sesión.')

    setUsuario(datos.usuario)
    return datos.usuario
  }, [])

  const cerrarSesion = useCallback(async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      // Aunque la petición falle, dejamos de mostrar el panel.
      setUsuario(null)
    }
  }, [])

  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion }),
    [usuario, cargando, iniciarSesion, cerrarSesion]
  )

  return <ContextoAdmin.Provider value={valor}>{children}</ContextoAdmin.Provider>
}
