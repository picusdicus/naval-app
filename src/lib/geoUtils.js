export function distanceInMeters(lat1, lon1, lat2, lon2) {
  const earthRadiusMeters = 6371000
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusMeters * c
}

export function getNearbyStops(userCoords, stops, radiusMeters = 600) {
  if (!userCoords || !stops) return []

  const stopsWithDistance = stops
    .map((stop) => ({
      ...stop,
      distance: distanceInMeters(
        userCoords.latitude,
        userCoords.longitude,
        stop.coordinates.latitude,
        stop.coordinates.longitude
      ),
    }))
    .filter((stop) => stop.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance)

  return stopsWithDistance
}
