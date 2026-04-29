import { useEffect, useMemo, useState } from 'react'
import { useFloorStore } from '../../store/useFloorStore'
import { getActiveReservation, isTableReservedNow, toDateMs } from '../../utils/reservations'
import { backendApi } from '../../services/backendApi'
import { FRONTEND_ORDER_LINE_STATUSES, orderLineStatusLabel } from '../../utils/orderLineStatus'
import { appendPaymentEvent } from '../../utils/paymentEvents'

const ORDER_STATUS_OPTIONS = FRONTEND_ORDER_LINE_STATUSES.filter((status) => status !== 'void')
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
]

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
  const waiterActiveSection = useFloorStore((state) => state.waiterActiveSection)
  const setWaiterActiveSection = useFloorStore((state) => state.setWaiterActiveSection)

  const [customItemName, setCustomItemName] = useState('')
  const [customNote, setCustomNote] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [menuPath, setMenuPath] = useState([])
  const activeSection = waiterActiveSection === 'reservations' ? 'reservations' : 'orders'
  const [reservationGuestName, setReservationGuestName] = useState('')
  const [reservationPartySize, setReservationPartySize] = useState('2')
  const [reservationStart, setReservationStart] = useState(nowLocalDateTime)
  const [reservationEnd, setReservationEnd] = useState(() => plusHoursLocalDateTime(3))
  const [reservationNote, setReservationNote] = useState('')
  const [timelineDate, setTimelineDate] = useState(() => toDateInputValue(new Date()))
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [savedOpeningHours, setSavedOpeningHours] = useState([])
  const [savedOpeningDateOverrides, setSavedOpeningDateOverrides] = useState([])
  const [paymentMode, setPaymentMode] = useState('single')
  const [singlePaymentMethod, setSinglePaymentMethod] = useState('card')
  const [splitCount, setSplitCount] = useState(2)
  const [splitPayments, setSplitPayments] = useState([
    { amount: '', method: 'cash' },
    { amount: '', method: 'card' },
  ])
  const [tipAmount, setTipAmount] = useState('')

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
  const normalizedTipAmount = useMemo(() => {
    const parsed = Number(tipAmount)
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, parsed)
  }, [tipAmount])
  const totalWithTip = useMemo(() => totalPrice + normalizedTipAmount, [totalPrice, normalizedTipAmount])
  const tableName = table?.metadata?.label ?? table?.type ?? 'Table'
  const seats = Math.max(1, Math.round(Number(table?.metadata?.seats ?? 1)))
  const activeReservation = getActiveReservation(table?.metadata)
  const reservedNow = isTableReservedNow(table?.metadata)
  const manualOccupiedUntilMs = toDateMs(table?.metadata?.manualOccupiedUntil)
  const hasManualOccupancy =
    manualOccupiedUntilMs !== null && manualOccupiedUntilMs > Date.now()

  const normalizedSplitCount = useMemo(() => {
    const numeric = Number(splitCount)
    if (!Number.isFinite(numeric)) return 2
    return Math.max(2, Math.min(12, Math.round(numeric)))
  }, [splitCount])

  const equalSplitAmount = useMemo(() => {
    if (normalizedSplitCount <= 0) return 0
    return totalWithTip / normalizedSplitCount
  }, [normalizedSplitCount, totalWithTip])

  const splitTotals = useMemo(() => {
    const amounts = splitPayments.slice(0, normalizedSplitCount).map((entry) => {
      const parsed = Number(entry.amount)
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed
      }
      return equalSplitAmount
    })

    const total = amounts.reduce((sum, amount) => sum + amount, 0)
    const difference = totalWithTip - total

    return {
      amounts,
      total,
      difference,
    }
  }, [splitPayments, normalizedSplitCount, equalSplitAmount, totalWithTip])

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

  const selectedDayOpening = useMemo(() => {
    const parsed = timelineDate ? new Date(`${timelineDate}T00:00`) : new Date()
    if (Number.isNaN(parsed.getTime())) return null

    const dayName = DAY_NAMES[parsed.getDay()]
    const dateKey = timelineDate
    const openingDateOverrides = savedOpeningDateOverrides.length > 0
      ? savedOpeningDateOverrides
      : (currentRestaurant?.openingDateOverrides ?? [])
    const overrideEntry = openingDateOverrides.find((item) => item.date === dateKey) ?? null

    if (overrideEntry) {
      return {
        dayName,
        entry: overrideEntry,
        isOverride: true,
      }
    }

    const openingHours = savedOpeningHours.length > 0
      ? savedOpeningHours
      : (currentRestaurant?.openingHours ?? [])
    const entry = openingHours.find((item) => item.day === dayName) ?? null

    return {
      dayName,
      entry,
      isOverride: false,
    }
  }, [
    timelineDate,
    currentRestaurant?.openingDateOverrides,
    currentRestaurant?.openingHours,
    savedOpeningDateOverrides,
    savedOpeningHours,
  ])

  const timelineClosedBlocks = useMemo(() => {
    const entry = selectedDayOpening?.entry
    if (!entry) {
      return [{ leftPct: 0, widthPct: 100 }]
    }

    if (entry.isClosed) {
      return [{ leftPct: 0, widthPct: 100 }]
    }

    const openMinutes = toMinutes(entry.open)
    const closeMinutes = toMinutes(entry.close)

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
  }, [selectedDayOpening])

  const selectedDayHoursText = useMemo(() => {
    const dayName = selectedDayOpening?.dayName ?? 'Selected day'
    const entry = selectedDayOpening?.entry
    const isOverride = Boolean(selectedDayOpening?.isOverride)

    if (!entry) return `${dayName}: not configured (treated as closed)`
    if (entry.isClosed) return `${dayName}: closed${isOverride ? ' (special date)' : ' (occupied)'}`
    return `${dayName}: open ${entry.open} - ${entry.close}${isOverride ? ' (special date)' : ''}`
  }, [selectedDayOpening])

  const isSelectedDayClosed = useMemo(() => {
    const entry = selectedDayOpening?.entry
    if (!entry) return true
    if (entry.isClosed) return true
    const openMinutes = toMinutes(entry.open)
    const closeMinutes = toMinutes(entry.close)
    return openMinutes === null || closeMinutes === null || openMinutes === closeMinutes
  }, [selectedDayOpening])

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
    setWaiterWorker(currentWorkerId)
  }, [setWaiterWorker, currentWorkerId])

  useEffect(() => {
    setSplitPayments((previous) => {
      const next = previous.slice(0, normalizedSplitCount)
      while (next.length < normalizedSplitCount) {
        next.push({ amount: '', method: 'cash' })
      }
      return next
    })
  }, [normalizedSplitCount])

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

  const settleBill = () => {
    if (orders.length === 0) {
      setFeedback('No order lines to settle.')
      return
    }

    if (paymentMode === 'split' && Math.abs(splitTotals.difference) > 0.01) {
      setFeedback('Split amounts must sum to the full table total before settling.')
      return
    }

    const uniqueOrderIds = [...new Set(orders.map((order) => order.tableOrderId).filter(Boolean))]
    if (uniqueOrderIds.length === 0) {
      setFeedback('No persisted table order found to settle.')
      return
    }

    const now = Date.now()
    const activeReservationIds = reservations
      .filter((reservation) => {
        const startMs = toDateMs(reservation.startAt)
        const endMs = toDateMs(reservation.endAt)
        return startMs !== null && endMs !== null && startMs <= now && now < endMs
      })
      .map((reservation) => reservation.id)

    const splitSummary = splitPayments
      .slice(0, normalizedSplitCount)
      .map((entry, index) => {
        const amount = splitTotals.amounts[index] ?? 0
        const methodLabel = PAYMENT_METHODS.find((option) => option.value === entry.method)?.label ?? 'Cash'
        return `${methodLabel} $${amount.toFixed(2)}`
      })
      .join(' | ')

    const singleAmount = totalWithTip
    const splitEntries = splitPayments.slice(0, normalizedSplitCount)
    const methodBreakdown = splitEntries.reduce(
      (accumulator, entry, index) => {
        const amount = splitTotals.amounts[index] ?? 0
        if (entry.method === 'card') {
          accumulator.card += amount
        } else {
          accumulator.cash += amount
        }
        return accumulator
      },
      { cash: 0, card: 0 },
    )
    const methodUsageCount = splitEntries.reduce(
      (accumulator, entry) => {
        if (entry.method === 'card') {
          accumulator.card += 1
        } else {
          accumulator.cash += 1
        }
        return accumulator
      },
      { cash: 0, card: 0 },
    )

    if (paymentMode === 'single') {
      if (singlePaymentMethod === 'card') {
        methodBreakdown.card = singleAmount
        methodBreakdown.cash = 0
        methodUsageCount.card = 1
        methodUsageCount.cash = 0
      } else {
        methodBreakdown.cash = singleAmount
        methodBreakdown.card = 0
        methodUsageCount.cash = 1
        methodUsageCount.card = 0
      }
    }

    const paymentSummary =
      paymentMode === 'single'
        ? `via ${singlePaymentMethod.toUpperCase()}`
        : `${normalizedSplitCount} splits (${splitSummary})`

    const reservationSummary =
      activeReservationIds.length > 0
        ? ` Active reservations cleared: ${activeReservationIds.length}.`
        : ''

    runMutation(
      () =>
        Promise.all(
          [
            ...uniqueOrderIds.map((orderId) =>
            backendApi.deleteTableOrder(currentRestaurantId, waiterTableId, orderId),
            ),
            ...activeReservationIds.map((reservationId) =>
              backendApi.deleteReservation(currentRestaurantId, reservationId),
            ),
          ],
        ).then(() => {
          appendPaymentEvent({
            restaurantId: currentRestaurantId,
            tableId: waiterTableId,
            amount: totalPrice,
            tipAmount: normalizedTipAmount,
            method: paymentMode === 'single' ? singlePaymentMethod : 'split',
            splitCount: paymentMode === 'split' ? normalizedSplitCount : 1,
            methodBreakdown,
            methodUsageCount,
            settledBy: currentWorkerName ?? '',
          })
        }),
      `Bill settled ${paymentSummary}.${reservationSummary}`,
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
            onClick={() =>
              setWaiterActiveSection(activeSection === 'orders' ? 'reservations' : 'orders')
            }
          >
            {activeSection === 'orders' ? 'Open Reservations Menu' : 'Back To Orders Menu'}
          </button>
        </div>

        {feedback ? (
          <div className="mb-4 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 shadow-sm">
            {feedback}
          </div>
        ) : null}

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

                <p className={`mb-2 text-[11px] font-semibold ${isSelectedDayClosed ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {selectedDayHoursText}
                </p>

                <div className="relative h-16 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.25)_1px,transparent_1px)] bg-[length:25%_100%]" />

                  {timelineClosedBlocks.map((block, index) => (
                    <div
                      key={`${block.leftPct}-${block.widthPct}-${index}`}
                      className="absolute bottom-0 top-0 border-x border-rose-300 bg-rose-200/70"
                      style={{
                        left: `${block.leftPct}%`,
                        width: `${block.widthPct}%`,
                      }}
                      title="Restaurant closed (occupied window)"
                    />
                  ))}

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
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Payment</h2>
            <p className="text-xs text-slate-500">
              Subtotal: ${totalPrice.toFixed(2)} | Tip: ${normalizedTipAmount.toFixed(2)} | Due: ${totalWithTip.toFixed(2)}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Tip</label>
            <input
              className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
              type="number"
              min="0"
              step="0.01"
              value={tipAmount}
              onChange={(event) => setTipAmount(event.target.value)}
              placeholder="0.00"
            />
            <button
              type="button"
              className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
              onClick={() => setTipAmount((totalPrice * 0.1).toFixed(2))}
            >
              +10%
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
              onClick={() => setTipAmount((totalPrice * 0.15).toFixed(2))}
            >
              +15%
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${paymentMode === 'single' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              onClick={() => setPaymentMode('single')}
            >
              Single Payment
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${paymentMode === 'split' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              onClick={() => setPaymentMode('split')}
            >
              Split Bill
            </button>
          </div>

          {paymentMode === 'single' ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Method</label>
              <select
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                value={singlePaymentMethod}
                onChange={(event) => setSinglePaymentMethod(event.target.value)}
              >
                {PAYMENT_METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Split count</label>
                <input
                  className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                  type="number"
                  min="2"
                  max="12"
                  step="1"
                  value={splitCount}
                  onChange={(event) => setSplitCount(event.target.value)}
                />
                <span className="text-[11px] text-slate-500">
                  Equal split default: ${equalSplitAmount.toFixed(2)} / person
                </span>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {splitPayments.slice(0, normalizedSplitCount).map((entry, index) => (
                  <div key={`split-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[11px] font-semibold text-slate-600">Guest {index + 1}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={equalSplitAmount.toFixed(2)}
                        value={entry.amount}
                        onChange={(event) =>
                          setSplitPayments((previous) =>
                            previous.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, amount: event.target.value } : item,
                            ),
                          )
                        }
                      />
                      <select
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                        value={entry.method}
                        onChange={(event) =>
                          setSplitPayments((previous) =>
                            previous.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, method: event.target.value } : item,
                            ),
                          )
                        }
                      >
                        {PAYMENT_METHODS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <p className={`text-[11px] ${Math.abs(splitTotals.difference) > 0.01 ? 'text-rose-600' : 'text-emerald-700'}`}>
                Split total: ${splitTotals.total.toFixed(2)} | Remaining: ${splitTotals.difference.toFixed(2)}
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={settleBill}
              disabled={isSaving || orders.length === 0}
            >
              Settle Bill
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                setPaymentMode('single')
                setSinglePaymentMethod('card')
                setSplitCount(2)
                setSplitPayments([
                  { amount: '', method: 'cash' },
                  { amount: '', method: 'card' },
                ])
                setTipAmount('')
              }}
              disabled={isSaving}
            >
              Reset Payment Form
            </button>
          </div>
        </div>

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
                        {ORDER_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {orderLineStatusLabel(status)}
                          </option>
                        ))}
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
