import { useEffect, useState } from 'react'

const NAVALCARNERO_LAT = 40.2306
const NAVALCARNERO_LON = -3.9958

const FALLBACK_WEATHER = {
  current: { temp: '--', condition: 'No disponible', icon: 'weather_update' },
  max: '--',
  loading: false,
  error: null,
}

export function useWeather() {
  const [weather, setWeather] = useState(FALLBACK_WEATHER)

  useEffect(() => {
    const fetchWeather = async () => {
      setWeather((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${NAVALCARNERO_LAT}&longitude=${NAVALCARNERO_LON}&current=temperature_2m,weather_code&daily=temperature_2m_max&timezone=auto`
        )

        if (!response.ok) throw new Error('Error al obtener datos meteorológicos')

        const data = await response.json()

        const current = data.current
        const daily = data.daily

        const temp = Math.round(current.temperature_2m)
        const maxTemp = Math.round(daily.temperature_2m_max[0])
        const weatherCode = current.weather_code

        const condition = getWeatherDescription(weatherCode)
        const icon = getWeatherIcon(weatherCode)

        setWeather({
          current: { temp, condition, icon },
          max: maxTemp,
          loading: false,
          error: null,
        })
      } catch (err) {
        console.error('Error fetching weather:', err)
        setWeather((prev) => ({
          ...prev,
          loading: false,
          error: err.message,
        }))
      }
    }

    fetchWeather()

    const interval = setInterval(fetchWeather, 600000)
    return () => clearInterval(interval)
  }, [])

  return weather
}

function getWeatherDescription(code) {
  const descriptions = {
    0: 'Despejado',
    1: 'Mayormente despejado',
    2: 'Parcialmente nublado',
    3: 'Nublado',
    45: 'Neblina',
    48: 'Neblina escarchada',
    51: 'Llovizna ligera',
    53: 'Llovizna moderada',
    55: 'Llovizna densa',
    61: 'Lluvia débil',
    63: 'Lluvia moderada',
    65: 'Lluvia fuerte',
    71: 'Nieve débil',
    73: 'Nieve moderada',
    75: 'Nieve fuerte',
    77: 'Granos de nieve',
    80: 'Aguaceros débiles',
    81: 'Aguaceros moderados',
    82: 'Aguaceros fuertes',
    85: 'Chubascos de nieve débil',
    86: 'Chubascos de nieve fuerte',
    95: 'Tormenta débil',
    96: 'Tormenta con granizo débil',
    99: 'Tormenta con granizo fuerte',
  }
  return descriptions[code] || 'No disponible'
}

function getWeatherIcon(code) {
  if (code === 0) return 'clear_day'
  if (code === 1 || code === 2) return 'partly_cloudy_day'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'foggy'
  if (code >= 51 && code <= 55) return 'grain'
  if (code >= 61 && code <= 65) return 'rainy'
  if (code >= 71 && code <= 77) return 'ac_unit'
  if (code >= 80 && code <= 82) return 'grain'
  if (code >= 85 && code <= 86) return 'ac_unit'
  if (code >= 95 && code <= 99) return 'thunderstorm'
  return 'weather_update'
}
