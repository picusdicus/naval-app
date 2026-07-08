import { useEffect, useState } from 'react'

export function useGeolocalizacion() {
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no disponible en este navegador')
      setCargando(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setError(null)
        setCargando(false)
      },
      (err) => {
        setError(err.message)
        setCoords(null)
        setCargando(false)
      },
      { timeout: 10000, enableHighAccuracy: false }
    )
  }, [])

  return { coords, error, cargando }
}
