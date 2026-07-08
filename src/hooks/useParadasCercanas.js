import { useEffect, useState } from 'react'
import { useGeolocalizacion } from './useGeolocalizacion.js'
import paradasData from '../data/paradas-navalcarnero.json'
import { paradasCercanas } from '../lib/geoUtils.js'
import { fetchTiempoReal } from '../lib/crtmApi.js'

export function useParadasCercanas() {
  const { coords, error: geoError, cargando: geoCargando } = useGeolocalizacion()
  const [paradas, setParadas] = useState([])
  const [tiemposReales, setTiemposReales] = useState({})
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!coords) {
      if (!geoCargando && geoError) {
        setCargando(false)
      }
      return
    }

    const paradasFiltered = paradasCercanas(coords, paradasData.paradas, 600)
    setParadas(paradasFiltered)

    const fetchTiempos = async () => {
      const tiempos = {}
      for (const parada of paradasFiltered.slice(0, 2)) {
        const minutos = await fetchTiempoReal(parada.codStop)
        if (minutos) {
          tiempos[parada.codStop] = minutos
        }
      }
      setTiemposReales(tiempos)
      setCargando(false)
    }

    fetchTiempos()
  }, [coords, geoCargando, geoError])

  return {
    paradas: paradas.slice(0, 2),
    tiemposReales,
    cargando: cargando || geoCargando,
    geoError,
  }
}
