const PAYMENT_EVENTS_STORAGE_KEY = 'bob.payments.events.v1'

const toNumber = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, numeric)
}

const sanitizeEvent = (event) => {
  if (!event || typeof event !== 'object') return null

  const cashAmount = toNumber(event?.methodBreakdown?.cash)
  const cardAmount = toNumber(event?.methodBreakdown?.card)
  const cashCount = Math.max(0, Math.round(Number(event?.methodUsageCount?.cash ?? 0) || 0))
  const cardCount = Math.max(0, Math.round(Number(event?.methodUsageCount?.card ?? 0) || 0))

  return {
    id: String(event.id ?? ''),
    restaurantId: String(event.restaurantId ?? ''),
    tableId: String(event.tableId ?? ''),
    amount: toNumber(event.amount),
    tipAmount: toNumber(event.tipAmount),
    method: String(event.method ?? 'cash'),
    splitCount: Math.max(1, Math.round(Number(event.splitCount ?? 1) || 1)),
    methodBreakdown: {
      cash: cashAmount,
      card: cardAmount,
    },
    methodUsageCount: {
      cash: cashCount,
      card: cardCount,
    },
    settledAt: String(event.settledAt ?? ''),
    settledBy: String(event.settledBy ?? ''),
  }
}

export const readPaymentEvents = () => {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(PAYMENT_EVENTS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.map(sanitizeEvent).filter(Boolean)
  } catch {
    return []
  }
}

export const appendPaymentEvent = (event) => {
  if (typeof window === 'undefined') return

  const nextEvent = sanitizeEvent({
    ...event,
    id: event?.id ?? `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    settledAt: event?.settledAt ?? new Date().toISOString(),
  })

  if (!nextEvent) return

  const current = readPaymentEvents()
  const next = [...current, nextEvent]

  try {
    window.localStorage.setItem(PAYMENT_EVENTS_STORAGE_KEY, JSON.stringify(next))
  } catch {
  }
}
