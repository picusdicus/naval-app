import { useEffect, useState, useCallback } from 'react'

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY

export function useRecaptcha() {
  const [cargando, setCargando] = useState(!RECAPTCHA_SITE_KEY)
  const [error, setError] = useState('')

  useEffect(() => {
    // En producción, no cargar reCAPTCHA (pendiente validación de Google)
    const esProduccion = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')
    if (esProduccion || !RECAPTCHA_SITE_KEY) {
      if (esProduccion) {
        console.warn('reCAPTCHA deshabilitado en producción (pendiente validación de Google), usando token simulado')
      } else {
        console.warn('reCAPTCHA no configurado (VITE_RECAPTCHA_SITE_KEY)')
      }
      setCargando(false)
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
      // En producción, localhost o si no está configurado, devolver token simulado
      const esProduccion = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')

      if (!RECAPTCHA_SITE_KEY || esProduccion || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        if (!RECAPTCHA_SITE_KEY) {
          console.warn('reCAPTCHA no configurado, usando token simulado')
        } else if (esProduccion) {
          console.warn('reCAPTCHA deshabilitado en producción (Google validando), usando token simulado')
        } else {
          console.log('✓ reCAPTCHA deshabilitado en localhost, token simulado')
        }
        return `token_${Date.now()}`
      }

      if (!window.grecaptcha) {
        console.warn('grecaptcha no disponible, usando token simulado')
        return `token_${Date.now()}`
      }

      try {
        const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action })
        return token
      } catch (err) {
        console.warn('Error en reCAPTCHA, usando token simulado:', err.message)
        return `token_${Date.now()}`
      }
    },
    []
  )

  return { getToken, cargando, error }
}
