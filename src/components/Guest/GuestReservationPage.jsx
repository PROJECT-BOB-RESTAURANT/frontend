import { useEffect, useMemo, useState } from 'react'
import { useFloorStore } from '../../store/useFloorStore'
import { isTableObjectType } from '../../utils/objectLibrary'
import { backendApi } from '../../services/backendApi'

const toDateTimeLocal = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

export const GuestReservationPage = () => {
  const restaurants = useFloorStore((state) => state.restaurants)
  const currentRestaurantId = useFloorStore((state) => state.currentRestaurantId)
  const currentFloorId = useFloorStore((state) => state.currentFloorId)
  const page = useFloorStore((state) => state.page)
  const editorMode = useFloorStore((state) => state.editorMode)
  const waiterTableId = useFloorStore((state) => state.waiterTableId)
  const waiterWorkerId = useFloorStore((state) => state.waiterWorkerId)
  const selectedObjectId = useFloorStore((state) => state.selectedObjectId)
  const hydrateFromBackend = useFloorStore((state) => state.hydrateFromBackend)
  const backToRestaurantManagement = useFloorStore((state) => state.backToRestaurantManagement)
  const [isSaving, setIsSaving] = useState(false)

  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? '')
  const [floorId, setFloorId] = useState('')
  const [tableId, setTableId] = useState('')
  const [guestName, setGuestName] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [startAt, setStartAt] = useState(() => toDateTimeLocal(new Date()))
  const [endAt, setEndAt] = useState(() => {
    const date = new Date()
    date.setHours(date.getHours() + 3)
    return toDateTimeLocal(date)
  })
  const [note, setNote] = useState('')
  const [feedback, setFeedback] = useState('')

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === restaurantId) ?? null,
    [restaurantId, restaurants],
  )

  const floors = selectedRestaurant?.floors ?? []
  const selectedFloor = useMemo(
    () => floors.find((floor) => floor.id === floorId) ?? null,
    [floorId, floors],
  )

  const tables = useMemo(
    () => (selectedFloor?.objects ?? []).filter((object) => isTableObjectType(object.type)),
    [selectedFloor],
  )

  useEffect(() => {
    if (!selectedRestaurant) {
      setFloorId('')
      return
    }

    const nextFloorId = selectedRestaurant.floors[0]?.id ?? ''
    setFloorId(nextFloorId)
  }, [selectedRestaurant])

  useEffect(() => {
    const nextTableId = tables[0]?.id ?? ''
    setTableId(nextTableId)
  }, [floorId, tables])

  const submitReservation = () => {
    if (!restaurantId || !floorId || !tableId) {
      setFeedback('Please select restaurant, floor, and table.')
      return
    }

    setIsSaving(true)
    backendApi
      .createReservation(restaurantId, {
        tableObjectId: tableId,
        guestName,
        partySize: Number(partySize) || 1,
        startAt,
        endAt,
        note,
      })
      .then(() => backendApi.fetchRestaurantsGraph())
      .then((graph) => {
        hydrateFromBackend(graph, {
          currentRestaurantId,
          currentFloorId,
          page,
          editorMode,
          waiterTableId,
          waiterWorkerId,
          selectedObjectId,
        })

        setFeedback('Reservation created successfully.')
        setGuestName('')
        setPartySize('2')
        setNote('')
      })
      .catch((error) => {
        setFeedback(error.message)
      })
      .finally(() => {
        setIsSaving(false)
      })
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-6">
      <section className="mx-auto max-w-3xl rounded-2xl border border-white/70 bg-white/80 p-6 shadow-2xl backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Guest Reservation</h1>
            <p className="text-sm text-slate-500">
              Pick a restaurant, floor, table, and time to create your reservation.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            onClick={backToRestaurantManagement}
          >
            Back
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Restaurant
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={restaurantId}
              onChange={(event) => setRestaurantId(event.target.value)}
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Floor
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={floorId}
              onChange={(event) => setFloorId(event.target.value)}
            >
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.name}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2 grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Table
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={tableId}
              onChange={(event) => setTableId(event.target.value)}
            >
              {tables.length > 0 ? (
                tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.metadata?.label ?? table.type} ({table.metadata?.seats ?? 0} seats)
                  </option>
                ))
              ) : (
                <option value="">No table found on this floor</option>
              )}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your Name
            <input
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              type="text"
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Party Size
            <input
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              type="number"
              min="1"
              step="1"
              value={partySize}
              onChange={(event) => setPartySize(event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Start Date & Time
            <input
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            End Date & Time
            <input
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              type="datetime-local"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
            />
          </label>

          <label className="md:col-span-2 grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Note (optional)
            <textarea
              className="h-20 rounded-md border border-slate-200 bg-white p-2 text-sm"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            disabled={isSaving}
            onClick={submitReservation}
          >
            {isSaving ? 'Saving...' : 'Create Reservation'}
          </button>

          {feedback ? <p className="text-xs text-slate-600">{feedback}</p> : null}
        </div>
      </section>
    </main>
  )
}
