export const DEFAULT_RESERVATION_HOURS = 3

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const toDateMs = (value) => {
  if (!value) return null
  const date = new Date(value)
  const ms = date.getTime()
  return Number.isFinite(ms) ? ms : null
}

const toDateKey = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const shiftDateKey = (dateKey, days) => {
  const date = new Date(`${dateKey}T00:00`)
  if (Number.isNaN(date.getTime())) return null
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

const toMinutes = (timeValue) => {
  const text = String(timeValue ?? '').trim()
  const match = text.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

const getEffectiveOpeningForDate = (dateKey, weeklyEntries, overrideEntries) => {
  const weekly = Array.isArray(weeklyEntries) ? weeklyEntries : []
  const overrides = Array.isArray(overrideEntries) ? overrideEntries : []

  const override = overrides.find((entry) => entry.date === dateKey) ?? null
  if (override) return override

  const parsed = new Date(`${dateKey}T00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  const dayName = DAY_NAMES[parsed.getDay()]
  return weekly.find((entry) => entry.day === dayName) ?? null
}

const formatOpeningWindow = (entry) => {
  const openMinutes = toMinutes(entry?.open)
  const closeMinutes = toMinutes(entry?.close)
  if (openMinutes === null || closeMinutes === null) return null

  const overnight = closeMinutes < openMinutes
  return `${entry.open} - ${entry.close}${overnight ? ' (next day)' : ''}`
}

export const validateReservationWithinOpeningHours = (
  startAt,
  endAt,
  weeklyEntries,
  overrideEntries,
) => {
  const startMs = toDateMs(startAt)
  const endMs = toDateMs(endAt)

  if (startMs === null || endMs === null) {
    return { isValid: false, message: 'Reservation start and end must be valid datetime values.' }
  }

  if (endMs <= startMs) {
    return { isValid: false, message: 'Reservation end time must be after start time.' }
  }

  const startDateKey = toDateKey(startAt)
  if (!startDateKey) {
    return { isValid: false, message: 'Reservation start and end must be valid datetime values.' }
  }

  const previousDateKey = shiftDateKey(startDateKey, -1)
  const candidateDateKeys = previousDateKey ? [startDateKey, previousDateKey] : [startDateKey]

  let hasOpenWindow = false
  const windowLabels = []

  for (const dateKey of candidateDateKeys) {
    const entry = getEffectiveOpeningForDate(dateKey, weeklyEntries, overrideEntries)
    if (!entry || entry.isClosed) {
      continue
    }

    const openMinutes = toMinutes(entry.open)
    const closeMinutes = toMinutes(entry.close)

    if (openMinutes === null || closeMinutes === null || openMinutes === closeMinutes) {
      continue
    }

    const overnight = closeMinutes < openMinutes
    const endDateKey = overnight ? shiftDateKey(dateKey, 1) : dateKey
    if (!endDateKey) {
      continue
    }

    const windowStartMs = toDateMs(`${dateKey}T${entry.open}`)
    const windowEndMs = toDateMs(`${endDateKey}T${entry.close}`)
    if (windowStartMs === null || windowEndMs === null || windowEndMs <= windowStartMs) {
      continue
    }

    hasOpenWindow = true

    const windowLabel = formatOpeningWindow(entry)
    if (windowLabel) {
      windowLabels.push(windowLabel)
    }

    if (startMs >= windowStartMs && endMs <= windowEndMs) {
      return { isValid: true, message: null }
    }
  }

  if (!hasOpenWindow) {
    return { isValid: false, message: 'Restaurant is closed for the selected reservation date.' }
  }

  const uniqueLabels = [...new Set(windowLabels)]
  if (uniqueLabels.length > 0) {
    return {
      isValid: false,
      message: `Reservation must be within opening hours: ${uniqueLabels.join(' or ')}.`,
    }
  }

  return {
    isValid: false,
    message: 'Reservation must be within restaurant opening hours for the selected time window.',
  }
}

const normalizeReservationEntry = (reservation) => {
  const startMs = toDateMs(reservation?.startAt) ?? Date.now()
  const endMsRaw = toDateMs(reservation?.endAt)
  const minEndMs = startMs + 15 * 60 * 1000
  const endMs = endMsRaw && endMsRaw > minEndMs ? endMsRaw : startMs + DEFAULT_RESERVATION_HOURS * 60 * 60 * 1000

  return {
    id: reservation?.id ?? `res_${crypto.randomUUID().slice(0, 8)}`,
    guestName: String(reservation?.guestName ?? '').trim() || 'Reservation',
    partySize: Math.max(1, Math.round(Number(reservation?.partySize ?? 1) || 1)),
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
    note: String(reservation?.note ?? '').trim(),
  }
}

export const normalizeReservations = (reservations) => {
  if (!Array.isArray(reservations)) return []

  return reservations
    .map(normalizeReservationEntry)
    .sort((a, b) => toDateMs(a.startAt) - toDateMs(b.startAt))
}

export const getActiveReservation = (metadata, now = Date.now()) => {
  const reservations = normalizeReservations(metadata?.reservations)
  return reservations.find((reservation) => {
    const startMs = toDateMs(reservation.startAt)
    const endMs = toDateMs(reservation.endAt)
    return startMs !== null && endMs !== null && startMs <= now && now < endMs
  }) ?? null
}

export const isTableReservedNow = (metadata, now = Date.now()) => {
  const activeReservation = getActiveReservation(metadata, now)
  const manualUntilMs = toDateMs(metadata?.manualOccupiedUntil)
  return Boolean(activeReservation || (manualUntilMs !== null && now < manualUntilMs))
}
