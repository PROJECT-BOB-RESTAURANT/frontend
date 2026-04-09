import { useEffect, useMemo, useState } from 'react'
import { backendApi } from '../services/backendApi'
import { toDateMs } from '../utils/reservations'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

const fallbackTableLabel = (table) => {
  const candidate = String(table?.metadata?.label ?? '').trim()
  if (candidate) return candidate
  const raw = String(table?.id ?? '')
  if (!raw) return 'Table'
  return `T-${raw.slice(0, 4).toUpperCase()}`
}

function ReservationStatisticsPage({
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
  const [activeTableId, setActiveTableId] = useState(null)
  const [guestName, setGuestName] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [reservationStart, setReservationStart] = useState('')
  const [reservationEnd, setReservationEnd] = useState('')
  const [reservationNote, setReservationNote] = useState('')

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
  const openingEntry = openingSource.find((entry) => entry.day === dayName) ?? null

  const closedBlocks = useMemo(() => {
    if (!openingEntry) return [{ leftPct: 0, widthPct: 100 }]
    if (openingEntry.isClosed) return [{ leftPct: 0, widthPct: 100 }]

    const openMinutes = toMinutes(openingEntry.open)
    const closeMinutes = toMinutes(openingEntry.close)

    if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
      return [{ leftPct: 0, widthPct: 100 }]
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
    if (openingEntry.isClosed) return `${dayName}: closed`
    return `${dayName}: ${openingEntry.open} - ${openingEntry.close}`
  }, [dayName, openingEntry])

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
      return
    }

    let active = true

    backendApi
      .getOpeningHours(currentRestaurantId)
      .then((hours) => {
        if (!active) return
        setSavedOpeningHours(Array.isArray(hours) ? hours : [])
      })
      .catch(() => {
        if (!active) return
        setSavedOpeningHours([])
      })

    return () => {
      active = false
    }
  }, [currentRestaurantId])

  const openFormForTable = (tableId) => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(now.getHours() + 2)

    setActiveTableId(tableId)
    setGuestName('')
    setPartySize('2')
    setReservationStart(toDateTimeLocal(now.toISOString()))
    setReservationEnd(toDateTimeLocal(next.toISOString()))
    setReservationNote('')
  }

  const submitReservation = async () => {
    if (!currentRestaurantId || !activeTableId) return

    if (!guestName.trim()) {
      setFeedback('Guest name is required.')
      return
    }

    setIsLoading(true)
    try {
      await backendApi.createReservation(currentRestaurantId, {
        tableObjectId: activeTableId,
        guestName,
        partySize: Number(partySize) || 1,
        startAt: reservationStart,
        endAt: reservationEnd,
        note: reservationNote,
      })

      await loadReservations()
      setFeedback('Reservation created.')
      setActiveTableId(null)
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

        {feedback ? <p className="mb-3 text-xs text-slate-600">{feedback}</p> : null}

        {floorsWithTables.length === 0 ? (
          <article className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            No table objects found for this restaurant.
          </article>
        ) : (
          <div className="space-y-4">
            {floorsWithTables.map((floor) => (
              <section key={floor.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{floor.name}</h2>

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
