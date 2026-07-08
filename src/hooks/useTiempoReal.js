import { useEffect, useState } from 'react'
import { fetchTiempoReal } from '../lib/crtmApi.js'

export function useTiempoReal(codStop) {
  const [llegadas, setLlegadas] = useState(null)

  useEffect(() => {
    if (!codStop) return

    const fetchData = async () => {
      const datos = await fetchTiempoReal(codStop)
      setLlegadas(datos)
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [codStop])

  return llegadas
}
