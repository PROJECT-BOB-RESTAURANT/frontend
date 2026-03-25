import { useEffect, useMemo, useState } from 'react'
import { useFloorStore } from '../../store/useFloorStore'
import { getActiveReservation, isTableReservedNow, toDateMs } from '../../utils/reservations'
import { backendApi } from '../../services/backendApi'

const findFolderByPath = (folders, pathIds) => {
  let currentFolders = folders
  let current = null

  for (const id of pathIds) {
    current = currentFolders.find((folder) => folder.id === id) ?? null
    if (!current) return null
    currentFolders = current.folders
  }

  return current
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

const nowLocalDateTime = () => toDateTimeLocal(new Date().toISOString())

const plusHoursLocalDateTime = (hours) => {
  const date = new Date()
  date.setHours(date.getHours() + hours)
  return toDateTimeLocal(date.toISOString())
}

const toDateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const WaiterPanel = () => {
  const waiterTableId = useFloorStore((state) => state.waiterTableId)
  const currentRestaurantId = useFloorStore((state) => state.currentRestaurantId)
  const currentRestaurant = useFloorStore((state) =>
    state.restaurants.find((restaurant) => restaurant.id === state.currentRestaurantId) ?? null,
  )
  const table = useFloorStore((state) =>
    state.objects.find((object) => object.id === state.waiterTableId) ?? null,
  )
  const backToEditorFromWaiter = useFloorStore((state) => state.backToEditorFromWaiter)
  const setWaiterWorker = useFloorStore((state) => state.setWaiterWorker)
  const setTableServiceData = useFloorStore((state) => state.setTableServiceData)
  const setTableManualOccupied = useFloorStore((state) => state.setTableManualOccupied)
  const extendTableManualOccupied = useFloorStore((state) => state.extendTableManualOccupied)
  const clearTableManualOccupied = useFloorStore((state) => state.clearTableManualOccupied)

  const [customItemName, setCustomItemName] = useState('')
  const [customNote, setCustomNote] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [menuPath, setMenuPath] = useState([])
  const [activeSection, setActiveSection] = useState('orders')
  const [reservationGuestName, setReservationGuestName] = useState('')
  const [reservationPartySize, setReservationPartySize] = useState('2')
  const [reservationStart, setReservationStart] = useState(nowLocalDateTime)
  const [reservationEnd, setReservationEnd] = useState(() => plusHoursLocalDateTime(3))
  const [reservationNote, setReservationNote] = useState('')
  const [timelineDate, setTimelineDate] = useState(() => toDateInputValue(new Date()))
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const orders = table?.metadata?.orders ?? []
  const reservations = (table?.metadata?.reservations ?? []).slice().sort((a, b) => {
    return (toDateMs(a.startAt) ?? 0) - (toDateMs(b.startAt) ?? 0)
  })
  const workers = currentRestaurant?.workers ?? []
  const session = backendApi.getAuthSession()
  const currentWorker = useMemo(() => {
    const sessionUserId = String(session?.userId ?? '').trim()
    const sessionUsername = String(session?.username ?? '').trim().toLowerCase()

    if (sessionUserId) {
      const byUserId = workers.find((worker) => String(worker.userId ?? '') === sessionUserId)
      if (byUserId) return byUserId
    }

    if (sessionUsername) {
      return (
        workers.find((worker) => String(worker.name ?? '').trim().toLowerCase() === sessionUsername) ?? null
      )
    }

    return null
  }, [workers, session?.userId, session?.username])
  const currentWorkerId = currentWorker?.id ?? null
  const currentWorkerName = currentWorker?.name ?? session?.username ?? null
  const rootFolders = currentRestaurant?.goodsCatalog ?? currentRestaurant?.goodsCategories ?? []
  const activeFolder = useMemo(() => findFolderByPath(rootFolders, menuPath), [rootFolders, menuPath])
  const visibleFolders = activeFolder ? activeFolder.folders : rootFolders
  const visibleItems = activeFolder ? activeFolder.items : []
  const totalItems = useMemo(
    () => orders.reduce((sum, order) => sum + order.quantity, 0),
    [orders],
  )
  const totalPrice = useMemo(
    () =>
      orders.reduce(
        (sum, order) => sum + order.quantity * Math.max(0, Number(order.unitPrice ?? 0) || 0),
        0,
      ),
    [orders],
  )
  const tableName = table?.metadata?.label ?? table?.type ?? 'Table'
  const seats = Math.max(1, Math.round(Number(table?.metadata?.seats ?? 1)))
  const activeReservation = getActiveReservation(table?.metadata)
  const reservedNow = isTableReservedNow(table?.metadata)
  const manualOccupiedUntilMs = toDateMs(table?.metadata?.manualOccupiedUntil)
  const hasManualOccupancy =
    manualOccupiedUntilMs !== null && manualOccupiedUntilMs > Date.now()

  const dayWindow = useMemo(() => {
    const parsed = timelineDate ? new Date(`${timelineDate}T00:00`) : new Date()
    const start = Number.isNaN(parsed.getTime()) ? new Date() : parsed
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    return {
      startMs: start.getTime(),
      endMs: end.getTime(),
    }
  }, [timelineDate])

  const todayTimelineReservations = useMemo(() => {
    const totalMs = dayWindow.endMs - dayWindow.startMs

    return reservations
      .map((reservation) => {
        const startMs = toDateMs(reservation.startAt)
        const endMs = toDateMs(reservation.endAt)
        if (startMs === null || endMs === null || endMs <= dayWindow.startMs || startMs >= dayWindow.endMs) {
          return null
        }

        const visibleStart = Math.max(startMs, dayWindow.startMs)
        const visibleEnd = Math.min(endMs, dayWindow.endMs)
        const leftPct = ((visibleStart - dayWindow.startMs) / totalMs) * 100
        const widthPct = Math.max(1, ((visibleEnd - visibleStart) / totalMs) * 100)

        return {
          ...reservation,
          leftPct,
          widthPct,
          isActive: startMs <= Date.now() && Date.now() < endMs,
        }
      })
      .filter(Boolean)
  }, [dayWindow.endMs, dayWindow.startMs, reservations])

  const nowIndicatorPct = useMemo(() => {
    const totalMs = dayWindow.endMs - dayWindow.startMs
    return Math.max(0, Math.min(100, ((Date.now() - dayWindow.startMs) / totalMs) * 100))
  }, [dayWindow.endMs, dayWindow.startMs])

  const isTimelineDayToday = useMemo(() => {
    const now = new Date()
    const today = toDateInputValue(now)
    return timelineDate === today
  }, [timelineDate])

  const refreshTableData = async () => {
    if (!currentRestaurantId || !waiterTableId) return
    const payload = await backendApi.fetchTableServiceState(currentRestaurantId, waiterTableId)
    setTableServiceData(waiterTableId, payload)
  }

  useEffect(() => {
    if (!currentRestaurantId || !waiterTableId) return

    refreshTableData().catch((error) => {
      setFeedback(error.message)
    })
  }, [currentRestaurantId, waiterTableId])

  useEffect(() => {
    setWaiterWorker(currentWorkerId)
  }, [setWaiterWorker, currentWorkerId])

  const runMutation = async (operation, successMessage) => {
    setIsSaving(true)
    try {
      await operation()
      await refreshTableData()
      if (successMessage) {
        setFeedback(successMessage)
      }
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const addReservation = () => {
    runMutation(
      () =>
        backendApi.createReservation(currentRestaurantId, {
          tableObjectId: waiterTableId,
          guestName: reservationGuestName,
          partySize: Number(reservationPartySize) || 1,
          startAt: reservationStart,
          endAt: reservationEnd,
          note: reservationNote,
        }),
      'Reservation created.',
    )

    setReservationGuestName('')
    setReservationPartySize('2')
    setReservationStart(nowLocalDateTime())
    setReservationEnd(plusHoursLocalDateTime(3))
    setReservationNote('')
  }

  const addOrderLine = (line) => {
    runMutation(async () => {
      const orderId = await backendApi.ensureOpenOrderId(
        currentRestaurantId,
        waiterTableId,
        currentWorkerId,
      )

      await backendApi.addOrderLine(currentRestaurantId, waiterTableId, orderId, line)
    }, 'Order line added.')
  }

  const updateOrderLine = (order, updates) => {
    if (!order?.tableOrderId) return
    runMutation(
      () =>
        backendApi.updateOrderLine(
          currentRestaurantId,
          waiterTableId,
          order.tableOrderId,
          order.id,
          {
            name: updates.name ?? order.name,
            quantity: updates.quantity ?? order.quantity,
            unitPrice: updates.unitPrice ?? order.unitPrice,
            note: updates.note ?? order.note,
            status: updates.status ?? order.status,
            placedByWorkerId: order.placedByWorkerId,
            placedByWorkerName: order.placedByWorkerName,
          },
        ),
      'Order line updated.',
    )
  }

  const deleteOrderLine = (order) => {
    if (!order?.tableOrderId) return
    runMutation(
      () =>
        backendApi.deleteOrderLine(
          currentRestaurantId,
          waiterTableId,
          order.tableOrderId,
          order.id,
        ),
      'Order line removed.',
    )
  }

  const clearOrders = () => {
    const uniqueOrderIds = [...new Set(orders.map((order) => order.tableOrderId).filter(Boolean))]
    runMutation(
      () =>
        Promise.all(
          uniqueOrderIds.map((orderId) =>
            backendApi.deleteTableOrder(currentRestaurantId, waiterTableId, orderId),
          ),
        ),
      'Table orders cleared.',
    )
  }

  if (!waiterTableId || !table) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-6">
        <section className="mx-auto max-w-3xl rounded-2xl border border-white/70 bg-white/80 p-6 shadow-2xl backdrop-blur">
          <h1 className="text-xl font-bold text-slate-800">Waiter Table Manager</h1>
          <p className="mt-2 text-sm text-slate-500">No table selected. Return to view mode and pick a table.</p>
          <button
            type="button"
            className="mt-4 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            onClick={backToEditorFromWaiter}
          >
            Back To Floor View
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-6">
      <section className="mx-auto max-w-6xl rounded-2xl border border-white/70 bg-white/80 p-6 shadow-2xl backdrop-blur">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            onClick={backToEditorFromWaiter}
          >
            Back To Floor View
          </button>

          <div>
            <h1 className="text-xl font-bold text-slate-800">Manage {tableName}</h1>
            <p className="text-sm text-slate-500">
              Max seats: {seats} | Items: {totalItems} | Total: ${totalPrice.toFixed(2)}
            </p>
            <p className={`text-xs font-semibold ${reservedNow ? 'text-rose-600' : 'text-emerald-600'}`}>
              {reservedNow ? 'Reserved right now' : 'Free right now'}
            </p>
          </div>

          <button
            type="button"
            className="ml-auto rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            onClick={() => setActiveSection(activeSection === 'orders' ? 'reservations' : 'orders')}
          >
            {activeSection === 'orders' ? 'Open Reservations Menu' : 'Back To Orders Menu'}
          </button>
        </div>

        {feedback ? <p className="mb-3 text-xs text-slate-600">{feedback}</p> : null}

        {activeSection === 'reservations' ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Reservation Menu
            </h2>
            <p className={`mt-1 text-xs font-semibold ${reservedNow ? 'text-rose-600' : 'text-emerald-600'}`}>
              {reservedNow ? 'Table is reserved/occupied now' : 'Table is free now'}
            </p>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Quick Occupancy
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                  onClick={() => setTableManualOccupied(waiterTableId, 180)}
                >
                  Mark Occupied (3h)
                </button>
                <button
                  type="button"
                  className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                  onClick={() => extendTableManualOccupied(waiterTableId, 30)}
                >
                  Extend Occupancy +30m
                </button>
                <button
                  type="button"
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  onClick={() => clearTableManualOccupied(waiterTableId)}
                >
                  Clear Manual Occupancy
                </button>
              </div>

              {activeReservation ? (
                <p className="mt-2 text-xs text-rose-600">
                  Active reservation: {activeReservation.guestName} ({activeReservation.partySize} guests)
                </p>
              ) : null}
              {hasManualOccupancy ? (
                <p className="text-xs text-amber-700">
                  Manual occupancy until: {new Date(manualOccupiedUntilMs).toLocaleString()}
                </p>
              ) : null}
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Add Reservation
              </h3>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  type="text"
                  placeholder="Guest name"
                  value={reservationGuestName}
                  onChange={(event) => setReservationGuestName(event.target.value)}
                />
                <input
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Party size"
                  value={reservationPartySize}
                  onChange={(event) => setReservationPartySize(event.target.value)}
                />
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Start Time
                  </label>
                  <input
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    type="datetime-local"
                    value={reservationStart}
                    onChange={(event) => setReservationStart(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    End Time
                  </label>
                  <input
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    type="datetime-local"
                    value={reservationEnd}
                    onChange={(event) => setReservationEnd(event.target.value)}
                  />
                </div>
                <textarea
                  className="md:col-span-2 h-16 rounded-md border border-slate-200 bg-white p-2 text-xs"
                  placeholder="Optional reservation note"
                  value={reservationNote}
                  onChange={(event) => setReservationNote(event.target.value)}
                />
                <button
                  type="button"
                  className="md:col-span-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                  disabled={isSaving}
                  onClick={addReservation}
                >
                  Add Reservation
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Tip: default reservation is 3 hours, but end time here lets you set exact duration.
              </p>
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Existing Reservations
              </h3>

              <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Day Timeline
                  </h4>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Day
                      </label>
                      <input
                        className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px]"
                        type="date"
                        value={timelineDate}
                        onChange={(event) => setTimelineDate(event.target.value)}
                      />
                      <span className="text-[11px] text-slate-500">Now: {new Date().toLocaleTimeString()}</span>
                    </div>
                </div>

                <div className="relative h-16 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.25)_1px,transparent_1px)] bg-[length:25%_100%]" />

                  {todayTimelineReservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className={`absolute top-2 h-12 rounded-md border px-1 py-0.5 text-[10px] font-semibold ${reservation.isActive ? 'border-rose-500 bg-rose-200/90 text-rose-800' : 'border-sky-500 bg-sky-200/90 text-sky-800'}`}
                      style={{
                        left: `${reservation.leftPct}%`,
                        width: `${reservation.widthPct}%`,
                      }}
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
              </div>

              {reservations.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {reservations.map((reservation) => {
                    const startMs = toDateMs(reservation.startAt)
                    const endMs = toDateMs(reservation.endAt)
                    const now = Date.now()
                    const isCurrent = startMs !== null && endMs !== null && startMs <= now && now < endMs

                    return (
                      <div
                        key={reservation.id}
                        className="rounded-md border border-slate-200 bg-white p-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800">
                            {reservation.guestName} ({reservation.partySize} guests)
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isCurrent ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                            {isCurrent ? 'Active now' : 'Scheduled'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {new Date(reservation.startAt).toLocaleString()} - {new Date(reservation.endAt).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            className="ml-auto rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                            onClick={() =>
                              runMutation(
                                () => {
                                  const endMs = toDateMs(reservation.endAt) ?? Date.now()
                                  const nextEnd = new Date(endMs + 30 * 60 * 1000).toISOString()
                                  return backendApi.updateReservation(
                                    currentRestaurantId,
                                    reservation.id,
                                    {
                                      endAt: nextEnd,
                                    },
                                  )
                                },
                                'Reservation extended.',
                              )
                            }
                          >
                            Extend +30m
                          </button>
                          <button
                            type="button"
                            className="rounded-md bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-200"
                            onClick={() =>
                              runMutation(
                                () =>
                                  backendApi.deleteReservation(currentRestaurantId, reservation.id),
                                'Reservation removed.',
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                        {reservation.note ? (
                          <p className="mt-1 text-xs text-slate-500">Note: {reservation.note}</p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">No reservations yet.</p>
              )}
            </div>
          </div>
        ) : null}

        {activeSection === 'orders' ? (
          <>
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
            onClick={clearOrders}
          >
            Clear Table Orders
          </button>
        </div>
        <div className="mb-4 max-w-sm rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order Placed By</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{currentWorkerName ?? 'Current user'}</p>
          {!currentWorkerId ? (
            <p className="mt-1 text-[11px] text-amber-700">
              You are not assigned as a worker in this restaurant yet. Orders will use your username.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Menu Folders
            </h2>

            <div className="mt-2 flex items-center gap-2">
              {menuPath.length > 0 ? (
                <button
                  type="button"
                  className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                  onClick={() => setMenuPath((prev) => prev.slice(0, -1))}
                >
                  Back
                </button>
              ) : null}
              <span className="text-xs text-slate-500">
                Current: {activeFolder ? activeFolder.name : 'Root'}
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {visibleFolders.length > 0 ? (
                visibleFolders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700"
                    onClick={() => setMenuPath((prev) => [...prev, folder.id])}
                  >
                    Open {folder.name}
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-500">
                  No folders at this level.
                </p>
              )}

              {visibleItems.length > 0 ? (
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  {visibleItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                      onClick={() =>
                        addOrderLine({
                          name: item.name,
                          quantity: 1,
                          unitPrice: item.price,
                          note: '',
                          status: 'pending',
                          placedByWorkerId: currentWorkerId,
                          placedByWorkerName: currentWorkerName,
                        })
                      }
                    >
                      + {item.name} <span className="text-slate-500">(${item.price.toFixed(2)})</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Custom Item</h3>
              <input
                className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                type="text"
                placeholder="Item name"
                value={customItemName}
                onChange={(event) => setCustomItemName(event.target.value)}
              />
              <textarea
                className="mt-2 h-20 w-full rounded-md border border-slate-200 p-2 text-sm"
                placeholder="Optional note"
                value={customNote}
                onChange={(event) => setCustomNote(event.target.value)}
              />
              <input
                className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                type="number"
                min="0"
                step="0.01"
                placeholder="Price"
                value={customPrice}
                onChange={(event) => setCustomPrice(event.target.value)}
              />
              <button
                type="button"
                className="mt-2 w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                onClick={() => {
                  if (!customItemName.trim()) return
                  addOrderLine({
                    name: customItemName,
                    quantity: 1,
                    unitPrice: Math.max(0, Number(customPrice) || 0),
                    note: customNote,
                    status: 'pending',
                    placedByWorkerId: currentWorkerId,
                    placedByWorkerName: currentWorkerName,
                  })
                  setCustomItemName('')
                  setCustomNote('')
                  setCustomPrice('')
                }}
              >
                Add Custom Order
              </button>
            </div>
          </aside>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Table Orders</h2>

            {orders.length > 0 ? (
              <div className="mt-3 space-y-2">
                {orders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-800">{order.name}</h3>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        Qty: {order.quantity}
                      </span>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        ${Math.max(0, Number(order.unitPrice ?? 0)).toFixed(2)}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Total: ${(order.quantity * Math.max(0, Number(order.unitPrice ?? 0))).toFixed(2)}
                      </span>
                      <select
                        className="ml-auto rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                        value={order.status}
                        onChange={(event) =>
                          updateOrderLine(order, { status: event.target.value })
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="served">Served</option>
                      </select>
                    </div>

                    {order.note ? (
                      <p className="mt-1 text-xs text-slate-500">Note: {order.note}</p>
                    ) : null}

                    <p className="mt-1 text-xs text-slate-500">
                      Placed by: {order.placedByWorkerName ?? 'Unassigned'}
                    </p>

                    <div className="mt-2 max-w-[140px]">
                      <input
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                        type="number"
                        min="0"
                        step="0.01"
                        value={Math.max(0, Number(order.unitPrice ?? 0))}
                        onChange={(event) =>
                          updateOrderLine(order, { unitPrice: Number(event.target.value) })
                        }
                      />
                    </div>

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        onClick={() => {
                          const nextQuantity = order.quantity - 1
                          if (nextQuantity <= 0) {
                            deleteOrderLine(order)
                            return
                          }
                          updateOrderLine(order, { quantity: nextQuantity })
                        }}
                      >
                        -
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        onClick={() => updateOrderLine(order, { quantity: order.quantity + 1 })}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="ml-auto rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                        onClick={() => deleteOrderLine(order)}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No orders yet. Add items from the restaurant catalog.
              </p>
            )}
          </section>
        </div>
          </>
        ) : null}
      </section>
    </main>
  )
}
