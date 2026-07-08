import { useEffect, useState } from 'react'
import { fetchRealTime } from '../lib/crtmApi.js'

export function useRealTime(stopCode) {
  const [arrivals, setArrivals] = useState(null)

  useEffect(() => {
    if (!stopCode) return

    const fetchData = async () => {
      const data = await fetchRealTime(stopCode)
      setArrivals(data)
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [stopCode])

  return arrivals
}
