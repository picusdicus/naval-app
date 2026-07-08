import { useEffect, useState } from 'react'

export function useGeolocation() {
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no disponible en este navegador')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setCoords(null)
        setLoading(false)
      },
      { timeout: 10000, enableHighAccuracy: false }
    )
  }, [])

  return { coords, error, loading }
}
