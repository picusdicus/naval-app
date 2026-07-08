// Utilities to calculate next departures from official CRTM schedules
// (src/data/horarios-bus.json). Shared by Transport section and assistant (api/_knowledge.js),
// so this must be pure JS.

export function getDayType(date = new Date()) {
  const dayOfWeek = date.getDay()
  if (dayOfWeek === 0) return 'holiday'
  if (dayOfWeek === 6) return 'saturday'
  return 'weekday'
}

export const DAY_TYPE_LABELS = {
  weekday: 'laborable',
  saturday: 'sábado',
  holiday: 'domingo y festivos',
}

export function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + minutes
}

// Next `n` departures today for a direction, with remaining minutes
export function getNextDepartures(schedules, date = new Date(), count = 3) {
  const dayType = getDayType(date)
  const currentTimeInMinutes = date.getHours() * 60 + date.getMinutes()
  return (schedules[dayType] || [])
    .filter((timeString) => timeToMinutes(timeString) >= currentTimeInMinutes)
    .slice(0, count)
    .map((timeString) => ({ time: timeString, minutesUntil: timeToMinutes(timeString) - currentTimeInMinutes }))
}

// First departure of next day (according to its day type)
export function getFirstDepartureNextDay(schedules, date = new Date()) {
  const tomorrow = new Date(date)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayType = getDayType(tomorrow)
  return (schedules[dayType] || [])[0] || null
}

// First and last departure today (for summaries)
export function getTodayRange(schedules, date = new Date()) {
  const dayType = getDayType(date)
  const times = schedules[dayType] || []
  if (!times.length) return null
  return { first: times[0], last: times[times.length - 1] }
}
