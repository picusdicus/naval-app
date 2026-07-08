import { useEffect, useState } from 'react'
import { useGeolocation } from './useGeolocation.js'
import stopsData from '../data/paradas-navalcarnero.json'
import { getNearbyStops } from '../lib/geoUtils.js'
import { fetchRealTime } from '../lib/crtmApi.js'

export function useNearbyStops() {
  const { coords, error: geoError, loading: geoLoading } = useGeolocation()
  const [stops, setStops] = useState([])
  const [realTimes, setRealTimes] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!coords) {
      if (!geoLoading && geoError) {
        setLoading(false)
      }
      return
    }

    const filteredStops = getNearbyStops(coords, stopsData.paradas, 2000)
    setStops(filteredStops)

    const fetchTimes = async () => {
      const times = {}
      for (const stop of filteredStops.slice(0, 2)) {
        const arrivals = await fetchRealTime(stop.codStop, stop.codLines)
        if (arrivals) {
          times[stop.codStop] = arrivals
        }
      }
      setRealTimes(times)
      setLoading(false)
    }

    fetchTimes()
  }, [coords, geoLoading, geoError])

  return {
    stops: stops.slice(0, 2),
    realTimes,
    loading: loading || geoLoading,
    geoError,
  }
}
