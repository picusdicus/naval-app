import { useEffect, useState, useCallback } from 'react'

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY

export function useRecaptcha() {
  const [cargando, setCargando] = useState(!RECAPTCHA_SITE_KEY)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) {
      console.warn('reCAPTCHA no configurado (VITE_RECAPTCHA_SITE_KEY)')
      return
    }

    if (window.grecaptcha) {
      setCargando(false)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://www.google.com/recaptcha/api.js'
    script.async = true
    script.defer = true

    script.onload = () => {
      setCargando(false)
    }

    script.onerror = () => {
      setError('No se pudo cargar reCAPTCHA')
      setCargando(false)
    }

    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  const getToken = useCallback(
    async (action = 'submit') => {
      // En development, devolver token simulado
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('✓ reCAPTCHA deshabilitado en localhost, token simulado')
        return `dev_token_${Date.now()}`
      }

      if (!RECAPTCHA_SITE_KEY) {
        console.warn('reCAPTCHA no configurado')
        return null
      }

      if (!window.grecaptcha) {
        setError('reCAPTCHA no está disponible')
        return null
      }

      try {
        const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action })
        return token
      } catch (err) {
        setError('Error al obtener token reCAPTCHA')
        console.error(err)
        return null
      }
    },
    []
  )

  return { getToken, cargando, error }
}
