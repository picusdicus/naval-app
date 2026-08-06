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
      // Verificar si grecaptcha se cargó pero rechaza la clave
      setTimeout(() => {
        if (window.grecaptcha && RECAPTCHA_SITE_KEY) {
          // Intentar un execute de prueba para detectar rechazo anticipado
          window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'test' })
            .catch(() => {
              // Si falla, usar token simulado
              console.warn('reCAPTCHA rechaza la clave, usando token simulado')
            })
        }
      }, 500)
      setCargando(false)
    }

    script.onerror = () => {
      console.warn('No se pudo cargar reCAPTCHA, usando token simulado')
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
      // En development o si no está configurado, devolver token simulado
      if (!RECAPTCHA_SITE_KEY || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        if (!RECAPTCHA_SITE_KEY) {
          console.warn('reCAPTCHA no configurado, usando token simulado')
        } else {
          console.log('✓ reCAPTCHA deshabilitado en localhost, token simulado')
        }
        return `token_${Date.now()}`
      }

      if (!window.grecaptcha) {
        setError('reCAPTCHA no está disponible')
        return null
      }

      try {
        const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action })
        return token
      } catch (err) {
        console.warn('reCAPTCHA error, usando token simulado:', err.message)
        // Fallback: devolver token simulado si Google rechaza la clave
        return `fallback_${Date.now()}`
      }
    },
    []
  )

  return { getToken, cargando, error }
}
