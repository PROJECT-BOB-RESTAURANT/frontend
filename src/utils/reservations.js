export const DEFAULT_RESERVATION_HOURS = 3

export const toDateMs = (value) => {
  if (!value) return null
  const date = new Date(value)
  const ms = date.getTime()
  return Number.isFinite(ms) ? ms : null
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
