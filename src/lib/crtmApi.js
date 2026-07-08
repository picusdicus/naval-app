export async function fetchRealTime(stopCode, allowedLines = null) {
  if (!stopCode) return null

  try {
    const response = await fetch(`/api/bus-times?codStop=${encodeURIComponent(stopCode)}`)
    if (!response.ok) return null

    const data = await response.json()
    if (!data || !data.stopTimes || !data.stopTimes.times) return null

    const arrivals = data.stopTimes.times.Time
    if (!Array.isArray(arrivals) || arrivals.length === 0) return null

    const now = new Date()
    const processedArrivals = arrivals
      .map((arrival) => {
        const line = arrival.line?.shortDescription || 'N/A'
        if (allowedLines && !allowedLines.includes(line)) {
          return null
        }
        const arrivalTime = new Date(arrival.time)
        const diffMs = arrivalTime - now
        const minutesUntilArrival = Math.ceil(diffMs / 60000)
        return minutesUntilArrival > 0
          ? {
              minutes: minutesUntilArrival,
              line: line,
              destination: arrival.destination || 'Destino desconocido',
            }
          : null
      })
      .filter((item) => item !== null)
      .slice(0, 3)

    return processedArrivals.length > 0 ? processedArrivals : null
  } catch (error) {
    console.error(`Error fetching real-time data for stop ${stopCode}:`, error)
    return null
  }
}
