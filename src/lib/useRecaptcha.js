import { useEffect, useState } from 'react'

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY

/**
 * Hook para obtener un token de reCAPTCHA v3.
 * Carga el script de Google y ejecuta grecaptcha.execute() cuando se solicita.
 * Retorna { token, loading, error, getToken }
 */
export function useRecaptcha() {
  const [scriptCargado, setScriptCargado] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!SITE_KEY || scriptCargado) return

    const script = document.createElement('script')
    script.src = 'https://www.google.com/recaptcha/api.js'
    script.async = true
    script.defer = true
    script.onload = () => setScriptCargado(true)
    script.onerror = () => setError('No se pudo cargar reCAPTCHA')
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [scriptCargado])

  const getToken = async (accion = 'submit') => {
    if (!SITE_KEY) {
      console.warn('reCAPTCHA no configurado (VITE_RECAPTCHA_SITE_KEY falta)')
      return null
    }

    if (!scriptCargado || !window.grecaptcha) {
      console.warn('reCAPTCHA script aún no cargado')
      return null
    }

    try {
      const token = await window.grecaptcha.execute(SITE_KEY, { action: accion })
      return token
    } catch (err) {
      setError(err.message)
      return null
    }
  }

  return { scriptCargado, error, getToken }
}
