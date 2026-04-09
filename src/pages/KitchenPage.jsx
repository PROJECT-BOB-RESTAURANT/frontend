import { useEffect, useMemo, useState } from 'react'
import { backendApi } from '../services/backendApi'
import { useFloorStore } from '../store/useFloorStore'
import {
  FRONTEND_ORDER_LINE_STATUSES,
  isKitchenVisibleStatus,
  orderLineStatusLabel,
} from '../utils/orderLineStatus'

const KITCHEN_STATUS_OPTIONS = FRONTEND_ORDER_LINE_STATUSES.filter((status) => status !== 'void')

const STATUS_BADGE_CLASS = {
  pending: 'border-amber-300 bg-amber-100 text-amber-800',
  inProgress: 'border-sky-300 bg-sky-100 text-sky-800',
  inPrep: 'border-indigo-300 bg-indigo-100 text-indigo-800',
  readyForServer: 'border-emerald-300 bg-emerald-100 text-emerald-800',
  served: 'border-slate-300 bg-slate-100 text-slate-700',
  void: 'border-rose-300 bg-rose-100 text-rose-700',
}

const STATUS_BUTTON_CLASS = {
  pending: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
  inProgress: 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100',
  inPrep: 'border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
  readyForServer: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  served: 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200',
}

const toDurationText = (durationMs) => {
  const totalSeconds = Math.max(0, Math.round((durationMs ?? 0) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

const elapsed = (startMs, endMs) => {
  if (!startMs || !endMs || endMs < startMs) return 0
  return endMs - startMs
}

const fallbackTableLabel = (tableObjectId) => {
  const raw = String(tableObjectId ?? '')
  if (raw.length < 4) return 'Table'
  return `Table ${raw.slice(0, 4).toUpperCase()}`
}

function KitchenPage() {
  const currentRestaurantId = useFloorStore((state) => state.currentRestaurantId)
  const restaurants = useFloorStore((state) => state.restaurants)
  const backToRestaurants = useFloorStore((state) => state.backToRestaurants)
  const switchRestaurantInKitchen = useFloorStore((state) => state.switchRestaurantInKitchen)

  const currentRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === currentRestaurantId) ?? null,
    [restaurants, currentRestaurantId],
  )

  const [kitchenLines, setKitchenLines] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [selectedLineId, setSelectedLineId] = useState(null)
  const [includeServed, setIncludeServed] = useState(false)

  const tableLookup = useMemo(() => {
    const byTableId = new Map()
    for (const floor of currentRestaurant?.floors ?? []) {
      for (const object of floor.objects ?? []) {
        byTableId.set(object.id, {
          floorName: floor.name,
          label: String(object.metadata?.label ?? '').trim() || fallbackTableLabel(object.id),
        })
      }
    }
    return byTableId
  }, [currentRestaurant])

  const visibleLines = useMemo(() => {
    const ordered = [...kitchenLines].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    if (includeServed) return ordered
    return ordered.filter((line) => isKitchenVisibleStatus(line.status))
  }, [kitchenLines, includeServed])

  const selectedLine = useMemo(
    () => visibleLines.find((line) => line.id === selectedLineId) ?? null,
    [visibleLines, selectedLineId],
  )

  const loadKitchenQueue = async (silent = false) => {
    if (!currentRestaurantId) return
    if (!silent) {
      setIsLoading(true)
    }
    try {
      const lines = await backendApi.listKitchenOrderLines(currentRestaurantId, { includeServed })
      setKitchenLines(lines)
      setFeedback('')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    loadKitchenQueue().catch(() => {})
  }, [currentRestaurantId, includeServed])

  useEffect(() => {
    if (!currentRestaurantId) return undefined
    const intervalId = window.setInterval(() => {
      loadKitchenQueue(true).catch(() => {})
    }, 10000)
    return () => window.clearInterval(intervalId)
  }, [currentRestaurantId, includeServed])

  const updateLineStatus = async (line, status) => {
    setIsLoading(true)
    try {
      await backendApi.updateOrderLine(
        currentRestaurantId,
        line.tableObjectId,
        line.tableOrderId,
        line.id,
        {
          status,
        },
      )
      await loadKitchenQueue(true)
      setFeedback(`Updated ${line.name} to ${orderLineStatusLabel(status)}.`)
      if (status === 'served' && !includeServed) {
        setSelectedLineId(null)
      }
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const lineTimings = useMemo(() => {
    if (!selectedLine) return null

    const now = Date.now()
    const createdAt = selectedLine.createdAt ?? now
    const inProgressAt = selectedLine.inProgressAt
    const inPrepAt = selectedLine.inPrepAt
    const readyAt = selectedLine.readyForServerAt
    const servedAt = selectedLine.servedAt

    const queuedEnd = inProgressAt ?? now
    const inProgressEnd = inPrepAt ?? (selectedLine.status === 'inProgress' ? now : null)
    const inPrepEnd = readyAt ?? (selectedLine.status === 'inPrep' ? now : null)
    const waitingEnd = servedAt ?? (selectedLine.status === 'readyForServer' ? now : null)

    return {
      queuedDuration: elapsed(createdAt, queuedEnd),
      inProgressDuration: elapsed(inProgressAt, inProgressEnd),
      inPrepDuration: elapsed(inPrepAt, inPrepEnd),
      waitingDuration: elapsed(readyAt, waitingEnd),
      totalDuration: elapsed(createdAt, servedAt ?? now),
    }
  }, [selectedLine])

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-4 sm:p-6">
      <section className="mx-auto max-w-7xl rounded-2xl border border-white/70 bg-white/80 p-4 shadow-2xl backdrop-blur sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            onClick={backToRestaurants}
          >
            Back To Restaurants
          </button>

          <select
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={currentRestaurantId ?? ''}
            onChange={(event) => switchRestaurantInKitchen(event.target.value)}
          >
            {restaurants.length === 0 ? <option value="">No restaurants</option> : null}
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            onClick={() => setIncludeServed((current) => !current)}
          >
            {includeServed ? 'Hide Served' : 'Show Served'}
          </button>

          <button
            type="button"
            className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            onClick={() => loadKitchenQueue()}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Kitchen</h1>
            <p className="text-sm text-slate-500">Incoming tickets sorted by arrival time. Tap a ticket to manage status and timing.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Active tickets: {visibleLines.length}
          </span>
        </div>

        {feedback ? (
          <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{feedback}</p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-3">
            {visibleLines.length > 0 ? (
              visibleLines.map((line) => {
                const tableData = tableLookup.get(line.tableObjectId)
                const tableLabel = tableData?.label ?? fallbackTableLabel(line.tableObjectId)
                const floorName = tableData?.floorName ?? line.floorName ?? 'Unknown floor'
                const badgeClass = STATUS_BADGE_CLASS[line.status] ?? STATUS_BADGE_CLASS.pending
                const selected = selectedLineId === line.id

                return (
                  <article
                    key={line.id}
                    className={`rounded-xl border bg-white p-4 shadow-sm transition ${selected ? 'border-sky-400 ring-2 ring-sky-200' : 'border-slate-200'}`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setSelectedLineId((current) => (current === line.id ? null : line.id))}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">{line.name}</h2>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                          {orderLineStatusLabel(line.status)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          Qty {line.quantity}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          ${line.unitPrice.toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        Table {tableLabel} | {floorName}
                      </p>
                      <p className="text-sm text-slate-600">
                        Server: {line.placedByWorkerName ?? 'Unknown'} | Placed: {new Date(line.createdAt).toLocaleTimeString()}
                      </p>
                      {line.note ? <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-sm text-amber-800">Note: {line.note}</p> : null}
                    </button>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {KITCHEN_STATUS_OPTIONS.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition ${STATUS_BUTTON_CLASS[status] ?? STATUS_BUTTON_CLASS.pending}`}
                          onClick={() => updateLineStatus(line, status)}
                          disabled={isLoading || line.status === status}
                        >
                          {orderLineStatusLabel(status)}
                        </button>
                      ))}
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                No active kitchen tickets.
              </div>
            )}
          </section>

          <aside className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Ticket Time Manager</h2>
            {selectedLine && lineTimings ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-bold text-slate-800">{selectedLine.name}</p>
                <p className="text-xs text-slate-500">{orderLineStatusLabel(selectedLine.status)}</p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Queued Before Work</p>
                  <p className="text-lg font-bold text-slate-800">{toDurationText(lineTimings.queuedDuration)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">In Progress</p>
                  <p className="text-lg font-bold text-slate-800">{toDurationText(lineTimings.inProgressDuration)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">In Prep</p>
                  <p className="text-lg font-bold text-slate-800">{toDurationText(lineTimings.inPrepDuration)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ready Waiting For Server</p>
                  <p className="text-lg font-bold text-slate-800">{toDurationText(lineTimings.waitingDuration)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-sky-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Total Ticket Time</p>
                  <p className="text-xl font-extrabold text-sky-900">{toDurationText(lineTimings.totalDuration)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Select a ticket to view detailed timing stats.</p>
            )}
          </aside>
        </div>
      </section>
    </main>
  )
}

export { KitchenPage }
