import { useEffect, useMemo, useState } from 'react'
import { backendApi } from '../services/backendApi'
import { toDateMs, validateReservationWithinOpeningHours } from '../utils/reservations'
import { readPaymentEvents } from '../utils/paymentEvents'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? ''))

const toDateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toDateTimeLocal = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hour}:${minute}`
}

const buildDayStart = (value) => {
  const parsed = value ? new Date(`${value}T00:00`) : new Date()
  if (Number.isNaN(parsed.getTime())) {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }
  parsed.setHours(0, 0, 0, 0)
  return parsed
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
  if (override) {
    return { entry: override, isOverride: true }
  }

  const parsed = new Date(`${dateKey}T00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return { entry: null, isOverride: false }
  }

  const dayName = DAY_NAMES[parsed.getDay()]
  return {
    entry: weekly.find((entry) => entry.day === dayName) ?? null,
    isOverride: false,
  }
}

const fallbackTableLabel = (table) => {
  const candidate = String(table?.metadata?.label ?? '').trim()
  if (candidate) return candidate
  const raw = String(table?.id ?? '')
  if (!raw) return 'Table'
  return `T-${raw.slice(0, 4).toUpperCase()}`
}

const formatCurrency = (value) => {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return '$0.00'
  return `$${numeric.toFixed(2)}`
}

function ReservationStatisticsPage({
  role,
  currentRestaurant,
  currentRestaurantId,
  restaurants,
  onSwitchRestaurant,
  onBackToRestaurants,
}) {
  const [timelineDate, setTimelineDate] = useState(() => toDateInputValue(new Date()))
  const [reservationsByTableId, setReservationsByTableId] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [savedOpeningHours, setSavedOpeningHours] = useState([])
  const [savedOpeningDateOverrides, setSavedOpeningDateOverrides] = useState([])
  const [activeTableId, setActiveTableId] = useState(null)
  const [activeFloorId, setActiveFloorId] = useState(null)
  const [guestName, setGuestName] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [reservationStart, setReservationStart] = useState('')
  const [reservationEnd, setReservationEnd] = useState('')
  const [reservationNote, setReservationNote] = useState('')
  const [kitchenLines, setKitchenLines] = useState([])
  const [paymentEvents, setPaymentEvents] = useState([])

  const dayStart = useMemo(() => buildDayStart(timelineDate), [timelineDate])
  const dayEnd = useMemo(() => {
    const end = new Date(dayStart)
    end.setDate(end.getDate() + 1)
    return end
  }, [dayStart])

  const isTimelineDayToday = useMemo(() => {
    const today = toDateInputValue(new Date())
    return timelineDate === today
  }, [timelineDate])

  const nowIndicatorPct = useMemo(() => {
    const dayLengthMs = dayEnd.getTime() - dayStart.getTime()
    return Math.max(0, Math.min(100, ((Date.now() - dayStart.getTime()) / dayLengthMs) * 100))
  }, [dayEnd, dayStart])

  const dayName = DAY_NAMES[dayStart.getDay()]
  const openingSource = savedOpeningHours.length > 0
    ? savedOpeningHours
    : (currentRestaurant?.openingHours ?? [])
  const openingOverrideSource = savedOpeningDateOverrides.length > 0
    ? savedOpeningDateOverrides
    : (currentRestaurant?.openingDateOverrides ?? [])
  const effectiveOpening = useMemo(
    () => getEffectiveOpeningForDate(timelineDate, openingSource, openingOverrideSource),
    [timelineDate, openingSource, openingOverrideSource],
  )
  const openingEntry = effectiveOpening.entry

  const closedBlocks = useMemo(() => {
    if (!openingEntry) return [{ leftPct: 0, widthPct: 100 }]
    if (openingEntry.isClosed) return [{ leftPct: 0, widthPct: 100 }]

    const openMinutes = toMinutes(openingEntry.open)
    const closeMinutes = toMinutes(openingEntry.close)

    if (openMinutes === null || closeMinutes === null || openMinutes === closeMinutes) {
      return [{ leftPct: 0, widthPct: 100 }]
    }

    if (closeMinutes < openMinutes) {
      return [{
        leftPct: (closeMinutes / (24 * 60)) * 100,
        widthPct: ((openMinutes - closeMinutes) / (24 * 60)) * 100,
      }]
    }

    const openPct = (openMinutes / (24 * 60)) * 100
    const closePct = (closeMinutes / (24 * 60)) * 100
    const blocks = []

    if (openPct > 0) {
      blocks.push({ leftPct: 0, widthPct: openPct })
    }

    if (closePct < 100) {
      blocks.push({ leftPct: closePct, widthPct: 100 - closePct })
    }

    return blocks
  }, [openingEntry])

  const openingHoursLabel = useMemo(() => {
    if (!openingEntry) return `${dayName}: not configured (closed)`
    if (openingEntry.isClosed) return `${dayName}: closed${effectiveOpening.isOverride ? ' (special date)' : ''}`
    return `${dayName}: ${openingEntry.open} - ${openingEntry.close}${effectiveOpening.isOverride ? ' (special date)' : ''}`
  }, [dayName, effectiveOpening.isOverride, openingEntry])

  const floorsWithTables = useMemo(() => {
    const floors = currentRestaurant?.floors ?? []
    return floors
      .map((floor) => ({
        ...floor,
        tables: (floor.objects ?? []).filter((object) => {
          const type = String(object.type ?? '')
          return type === 'square_table' || type === 'round_table' || type === 'large_table'
        }),
      }))
      .filter((floor) => floor.tables.length > 0)
  }, [currentRestaurant])

  const canSeeManagerAnalytics = role === 'MANAGER' || role === 'ADMIN'

  const loadReservations = async () => {
    if (!currentRestaurantId) return

    const tableIds = floorsWithTables.flatMap((floor) => floor.tables.map((table) => table.id))
    if (tableIds.length === 0) {
      setReservationsByTableId({})
      return
    }

    setIsLoading(true)
    try {
      const entries = await Promise.all(
        tableIds.map(async (tableId) => ({
          tableId,
          reservations: await backendApi.listTableReservations(currentRestaurantId, tableId),
        })),
      )

      const next = {}
      for (const entry of entries) {
        next[entry.tableId] = entry.reservations
      }

      setReservationsByTableId(next)
      setPaymentEvents(readPaymentEvents())
      setFeedback('')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadReservations().catch(() => {})
  }, [currentRestaurantId, floorsWithTables.length])

  useEffect(() => {
    if (!currentRestaurantId) {
      setSavedOpeningHours([])
      setSavedOpeningDateOverrides([])
      return
    }

    let active = true

    Promise.all([
      backendApi.getOpeningHours(currentRestaurantId),
      backendApi.getOpeningHourOverrides(currentRestaurantId),
    ])
      .then(([hours, overrides]) => {
        if (!active) return
        setSavedOpeningHours(Array.isArray(hours) ? hours : [])
        setSavedOpeningDateOverrides(Array.isArray(overrides) ? overrides : [])
      })
      .catch(() => {
        if (!active) return
        setSavedOpeningHours([])
        setSavedOpeningDateOverrides([])
      })

    return () => {
      active = false
    }
  }, [currentRestaurantId])

  useEffect(() => {
    if (!currentRestaurantId || !canSeeManagerAnalytics) {
      setKitchenLines([])
      return
    }

    let active = true

    backendApi
      .listKitchenOrderLines(currentRestaurantId, { includeServed: true })
      .then((lines) => {
        if (!active) return
        setKitchenLines(Array.isArray(lines) ? lines : [])
      })
      .catch(() => {
        if (!active) return
        setKitchenLines([])
      })

    return () => {
      active = false
    }
  }, [currentRestaurantId, canSeeManagerAnalytics])

  useEffect(() => {
    setPaymentEvents(readPaymentEvents())
  }, [currentRestaurantId, timelineDate])

  const analytics = useMemo(() => {
    const allReservations = Object.values(reservationsByTableId).flatMap((entry) =>
      Array.isArray(entry) ? entry : [],
    )

    const now = Date.now()
    const dayStartMs = dayStart.getTime()
    const dayEndMs = dayEnd.getTime()

    const activeReservations = allReservations.filter((reservation) => {
      const startMs = toDateMs(reservation.startAt)
      const endMs = toDateMs(reservation.endAt)
      return startMs !== null && endMs !== null && startMs <= now && now < endMs
    })

    const todayReservations = allReservations.filter((reservation) => {
      const startMs = toDateMs(reservation.startAt)
      const endMs = toDateMs(reservation.endAt)
      return startMs !== null && endMs !== null && endMs > dayStartMs && startMs < dayEndMs
    })

    const openLines = kitchenLines.filter((line) => line.status !== 'served' && line.status !== 'void')

    const restaurantPayments = paymentEvents.filter((event) => event.restaurantId === currentRestaurantId)

    const paidRevenue = restaurantPayments.reduce((sum, event) => sum + (Number(event.amount ?? 0) || 0), 0)
    const tipRevenue = restaurantPayments.reduce((sum, event) => sum + (Number(event.tipAmount ?? 0) || 0), 0)
    const openRevenue = openLines.reduce(
      (sum, line) => sum + (Number(line.unitPrice ?? 0) || 0) * Math.max(1, Number(line.quantity ?? 1) || 1),
      0,
    )

    const paidTransactionsTotal = restaurantPayments.length
    const cashPaymentsTotal = restaurantPayments.reduce(
      (sum, event) => sum + (Number(event.methodBreakdown?.cash ?? 0) || 0),
      0,
    )
    const cardPaymentsTotal = restaurantPayments.reduce(
      (sum, event) => sum + (Number(event.methodBreakdown?.card ?? 0) || 0),
      0,
    )
    const cashUsageCount = restaurantPayments.reduce(
      (sum, event) => sum + Math.max(0, Number(event.methodUsageCount?.cash ?? 0) || 0),
      0,
    )
    const cardUsageCount = restaurantPayments.reduce(
      (sum, event) => sum + Math.max(0, Number(event.methodUsageCount?.card ?? 0) || 0),
      0,
    )

    const reservationCountByFloor = floorsWithTables.map((floor) => {
      const count = floor.tables.reduce((sum, table) => {
        const reservations = reservationsByTableId[table.id]
        return sum + (Array.isArray(reservations) ? reservations.length : 0)
      }, 0)

      return {
        floorId: floor.id,
        floorName: floor.name,
        tableCount: floor.tables.length,
        reservationCount: count,
      }
    })

    return {
      reservationTotal: allReservations.length,
      activeReservationTotal: activeReservations.length,
      todayReservationTotal: todayReservations.length,
      paidRevenue,
      tipRevenue,
      openRevenue,
      paidTransactionsTotal,
      cashPaymentsTotal,
      cardPaymentsTotal,
      cashUsageCount,
      cardUsageCount,
      openLinesTotal: openLines.length,
      reservationCountByFloor,
    }
  }, [
    reservationsByTableId,
    dayStart,
    dayEnd,
    kitchenLines,
    floorsWithTables,
    paymentEvents,
    currentRestaurantId,
  ])

  const revenueDiagram = useMemo(() => {
    const cash = Math.max(0, Number(analytics.cashPaymentsTotal) || 0)
    const card = Math.max(0, Number(analytics.cardPaymentsTotal) || 0)
    const total = cash + card
    const cashPct = total > 0 ? (cash / total) * 100 : 0
    const cardPct = total > 0 ? (card / total) * 100 : 0

    return {
      cash,
      card,
      total,
      cashPct,
      cardPct,
      chartStyle: {
        background: `conic-gradient(#16a34a 0% ${cashPct}%, #2563eb ${cashPct}% 100%)`,
      },
    }
  }, [analytics.cashPaymentsTotal, analytics.cardPaymentsTotal])

  const floorReservationDiagram = useMemo(() => {
    const rows = analytics.reservationCountByFloor
    const maxCount = rows.reduce((max, row) => Math.max(max, row.reservationCount), 0)

    return rows.map((row) => ({
      ...row,
      fillPct: maxCount > 0 ? (row.reservationCount / maxCount) * 100 : 0,
    }))
  }, [analytics.reservationCountByFloor])

  const openFormForTable = (tableId) => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(now.getHours() + 2)

    setActiveFloorId(null)
    setActiveTableId(tableId)
    setGuestName('')
    setPartySize('2')
    setReservationStart(toDateTimeLocal(now.toISOString()))
    setReservationEnd(toDateTimeLocal(next.toISOString()))
    setReservationNote('')
  }

  const openFormForFloor = (floorId) => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(now.getHours() + 2)

    setActiveTableId(null)
    setActiveFloorId(floorId)
    setGuestName('')
    setPartySize('2')
    setReservationStart(toDateTimeLocal(now.toISOString()))
    setReservationEnd(toDateTimeLocal(next.toISOString()))
    setReservationNote('')
  }

  const submitReservation = async () => {
    if (!currentRestaurantId || (!activeTableId && !activeFloorId)) return

    if (!guestName.trim()) {
      setFeedback('Guest name is required.')
      return
    }

    const startMs = toDateMs(reservationStart)
    const endMs = toDateMs(reservationEnd)

    if (startMs === null || endMs === null) {
      setFeedback('Reservation start and end must be valid datetime values.')
      return
    }

    if (endMs <= startMs) {
      setFeedback('Reservation end time must be after start time.')
      return
    }

    const openingValidation = validateReservationWithinOpeningHours(
      reservationStart,
      reservationEnd,
      openingSource,
      openingOverrideSource,
    )
    if (!openingValidation.isValid) {
      setFeedback(openingValidation.message)
      return
    }

    let targetTableIds = []
    if (activeTableId) {
      targetTableIds = [activeTableId]
    } else {
      const targetFloor = floorsWithTables.find((floor) => floor.id === activeFloorId)
      targetTableIds = (targetFloor?.tables ?? []).map((table) => table.id)
    }

    const persistedTableIds = targetTableIds.filter((tableId) => isUuid(tableId))
    if (persistedTableIds.length === 0) {
      setFeedback('No persisted tables found on this floor. Save floor layout first.')
      return
    }

    setIsLoading(true)
    try {
      await Promise.all(
        persistedTableIds.map((tableObjectId) =>
          backendApi.createReservation(currentRestaurantId, {
            tableObjectId,
            guestName,
            partySize: Number(partySize) || 1,
            startAt: reservationStart,
            endAt: reservationEnd,
            note: reservationNote,
          }),
        ),
      )

      await loadReservations()
      setFeedback(
        persistedTableIds.length > 1
          ? `Reservations created for ${persistedTableIds.length} tables.`
          : 'Reservation created.',
      )
      setActiveTableId(null)
      setActiveFloorId(null)
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-6">
      <section className="mx-auto max-w-7xl rounded-2xl border border-white/70 bg-white/80 p-6 shadow-2xl backdrop-blur">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            onClick={onBackToRestaurants}
          >
            Back To Restaurants
          </button>

          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
            value={currentRestaurantId ?? ''}
            onChange={(event) => onSwitchRestaurant(event.target.value)}
          >
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>

          <label className="ml-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Day
            <input
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
              type="date"
              value={timelineDate}
              onChange={(event) => setTimelineDate(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            onClick={() => loadReservations()}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold text-slate-800">Reservation Statistics</h1>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {openingHoursLabel}
          </span>
        </div>

        {canSeeManagerAnalytics ? (
          <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Manager Analytics</h2>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Paid Income</p>
                <p className="mt-1 text-xl font-extrabold text-emerald-900">{formatCurrency(analytics.paidRevenue)}</p>
                <p className="text-[11px] text-emerald-700">Payments settled: {analytics.paidTransactionsTotal}</p>
              </article>

              <article className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Tips Total</p>
                <p className="mt-1 text-xl font-extrabold text-violet-900">{formatCurrency(analytics.tipRevenue)}</p>
                <p className="text-[11px] text-violet-700">Captured at settlement</p>
              </article>

              <article className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Open Ticket Value</p>
                <p className="mt-1 text-xl font-extrabold text-amber-900">{formatCurrency(analytics.openRevenue)}</p>
                <p className="text-[11px] text-amber-700">Open lines: {analytics.openLinesTotal}</p>
              </article>

              <article className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Reservations Total</p>
                <p className="mt-1 text-xl font-extrabold text-sky-900">{analytics.reservationTotal}</p>
                <p className="text-[11px] text-sky-700">Current day overlap: {analytics.todayReservationTotal}</p>
              </article>

              <article className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Active Reservations</p>
                <p className="mt-1 text-xl font-extrabold text-rose-900">{analytics.activeReservationTotal}</p>
                <p className="text-[11px] text-rose-700">Right now</p>
              </article>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {analytics.reservationCountByFloor.map((entry) => (
                <article key={entry.floorId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">{entry.floorName}</p>
                  <p className="text-xs text-slate-600">Tables: {entry.tableCount}</p>
                  <p className="text-xs text-slate-600">Reservations: {entry.reservationCount}</p>
                </article>
              ))}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Cash vs Card Usage</h3>

                <div className="mt-3 flex items-center gap-4">
                  <div className="relative h-24 w-24 rounded-full" style={revenueDiagram.chartStyle}>
                    <div className="absolute inset-4 rounded-full bg-white" />
                  </div>

                  <div className="space-y-1 text-xs text-slate-700">
                    <p>
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" />{' '}
                      Cash: {formatCurrency(revenueDiagram.cash)} ({revenueDiagram.cashPct.toFixed(1)}%)
                    </p>
                    <p>
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />{' '}
                      Card: {formatCurrency(revenueDiagram.card)} ({revenueDiagram.cardPct.toFixed(1)}%)
                    </p>
                    <p className="font-semibold text-slate-900">Total paid methods: {formatCurrency(revenueDiagram.total)}</p>
                    <p className="text-[11px] text-slate-600">
                      Usage count: cash {analytics.cashUsageCount} | card {analytics.cardUsageCount}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Floor Reservation Diagram</h3>

                <div className="mt-3 space-y-2">
                  {floorReservationDiagram.map((entry) => (
                    <div key={entry.floorId}>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                        <span>{entry.floorName}</span>
                        <span>{entry.reservationCount}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-sky-600"
                          style={{ width: `${entry.fillPct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {feedback ? (
          <div className="mb-4 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 shadow-sm">
            {feedback}
          </div>
        ) : null}

        {floorsWithTables.length === 0 ? (
          <article className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            No table objects found for this restaurant.
          </article>
        ) : (
          <div className="space-y-4">
            {floorsWithTables.map((floor) => (
              <section key={floor.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{floor.name}</h2>
                  <button
                    type="button"
                    className="ml-auto rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-700"
                    onClick={() => openFormForFloor(floor.id)}
                  >
                    Reserve Entire Floor
                  </button>
                </div>

                {activeFloorId === floor.id ? (
                  <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                    <input
                      className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      type="text"
                      placeholder="Guest name"
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                    />
                    <input
                      className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Party size"
                      value={partySize}
                      onChange={(event) => setPartySize(event.target.value)}
                    />
                    <input
                      className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      type="datetime-local"
                      value={reservationStart}
                      onChange={(event) => setReservationStart(event.target.value)}
                    />
                    <input
                      className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      type="datetime-local"
                      value={reservationEnd}
                      onChange={(event) => setReservationEnd(event.target.value)}
                    />
                    <textarea
                      className="md:col-span-2 h-16 rounded-md border border-slate-200 bg-white p-2 text-xs"
                      placeholder="Optional note"
                      value={reservationNote}
                      onChange={(event) => setReservationNote(event.target.value)}
                    />
                    <div className="md:col-span-2 flex gap-2">
                      <button
                        type="button"
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                        onClick={submitReservation}
                        disabled={isLoading}
                      >
                        Save Floor Reservation
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        onClick={() => setActiveFloorId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 space-y-3">
                  {floor.tables.map((table) => {
                    const tableReservations = reservationsByTableId[table.id] ?? []
                    const dayLengthMs = dayEnd.getTime() - dayStart.getTime()
                    const timelineReservations = tableReservations
                      .map((reservation) => {
                        const startMs = toDateMs(reservation.startAt)
                        const endMs = toDateMs(reservation.endAt)
                        if (startMs === null || endMs === null || endMs <= dayStart.getTime() || startMs >= dayEnd.getTime()) {
                          return null
                        }

                        const visibleStart = Math.max(startMs, dayStart.getTime())
                        const visibleEnd = Math.min(endMs, dayEnd.getTime())
                        return {
                          ...reservation,
                          leftPct: ((visibleStart - dayStart.getTime()) / dayLengthMs) * 100,
                          widthPct: Math.max(1, ((visibleEnd - visibleStart) / dayLengthMs) * 100),
                          isActive: startMs <= Date.now() && Date.now() < endMs,
                        }
                      })
                      .filter(Boolean)

                    return (
                      <article key={table.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-800">{fallbackTableLabel(table)}</h3>
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            Seats: {Math.max(1, Number(table.metadata?.seats ?? 1))}
                          </span>
                          <button
                            type="button"
                            className="ml-auto rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500"
                            onClick={() => openFormForTable(table.id)}
                          >
                            Add Reservation
                          </button>
                        </div>

                        <div className="relative h-14 overflow-hidden rounded-md border border-slate-200 bg-white">
                          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.25)_1px,transparent_1px)] bg-[length:25%_100%]" />

                          {closedBlocks.map((block, index) => (
                            <div
                              key={`${table.id}-${block.leftPct}-${block.widthPct}-${index}`}
                              className="absolute bottom-0 top-0 border-x border-rose-300 bg-rose-200/70"
                              style={{ left: `${block.leftPct}%`, width: `${block.widthPct}%` }}
                              title="Restaurant closed"
                            />
                          ))}

                          {timelineReservations.map((reservation) => (
                            <div
                              key={reservation.id}
                              className={`absolute top-1 h-12 rounded-md border px-1 py-0.5 text-[10px] font-semibold ${reservation.isActive ? 'border-rose-500 bg-rose-200/90 text-rose-800' : 'border-sky-500 bg-sky-200/90 text-sky-800'}`}
                              style={{ left: `${reservation.leftPct}%`, width: `${reservation.widthPct}%` }}
                              title={`${reservation.guestName}: ${new Date(reservation.startAt).toLocaleTimeString()} - ${new Date(reservation.endAt).toLocaleTimeString()}`}
                            >
                              <div className="truncate">{reservation.guestName}</div>
                            </div>
                          ))}

                          {isTimelineDayToday ? (
                            <div
                              className="absolute bottom-0 top-0 w-[2px] bg-rose-700"
                              style={{ left: `${nowIndicatorPct}%` }}
                              title="Current time"
                            />
                          ) : null}
                        </div>

                        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                          <span>00:00</span>
                          <span>06:00</span>
                          <span>12:00</span>
                          <span>18:00</span>
                          <span>24:00</span>
                        </div>

                        {activeTableId === table.id ? (
                          <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-2">
                            <input
                              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                              type="text"
                              placeholder="Guest name"
                              value={guestName}
                              onChange={(event) => setGuestName(event.target.value)}
                            />
                            <input
                              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                              type="number"
                              min="1"
                              step="1"
                              placeholder="Party size"
                              value={partySize}
                              onChange={(event) => setPartySize(event.target.value)}
                            />
                            <input
                              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                              type="datetime-local"
                              value={reservationStart}
                              onChange={(event) => setReservationStart(event.target.value)}
                            />
                            <input
                              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                              type="datetime-local"
                              value={reservationEnd}
                              onChange={(event) => setReservationEnd(event.target.value)}
                            />
                            <textarea
                              className="md:col-span-2 h-16 rounded-md border border-slate-200 bg-white p-2 text-xs"
                              placeholder="Optional note"
                              value={reservationNote}
                              onChange={(event) => setReservationNote(event.target.value)}
                            />
                            <div className="md:col-span-2 flex gap-2">
                              <button
                                type="button"
                                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                                onClick={submitReservation}
                                disabled={isLoading}
                              >
                                Save Reservation
                              </button>
                              <button
                                type="button"
                                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                                onClick={() => setActiveTableId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export { ReservationStatisticsPage }
