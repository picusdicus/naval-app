export async function fetchTiempoReal(codStop) {
  if (!codStop) return null

  try {
    const response = await fetch(`/api/bus-times?codStop=${encodeURIComponent(codStop)}`)
    if (!response.ok) return null

    const data = await response.json()
    if (!data || !data.stopTimes || !data.stopTimes.times) return null

    const arrivals = data.stopTimes.times.Time
    if (!Array.isArray(arrivals) || arrivals.length === 0) return null

    const now = new Date()
    const llegadas = arrivals
      .map((arrival) => {
        const arrivalTime = new Date(arrival.time)
        const diffMs = arrivalTime - now
        const diffMinutos = Math.ceil(diffMs / 60000)
        return diffMinutos > 0
          ? {
              minutos: diffMinutos,
              linea: arrival.line?.shortDescription || 'N/A',
              destino: arrival.destination || 'Destino desconocido',
            }
          : null
      })
      .filter((l) => l !== null)
      .slice(0, 3)

    return llegadas.length > 0 ? llegadas : null
  } catch (error) {
    console.error(`Error fetching real-time data for stop ${codStop}:`, error)
    return null
  }
}
