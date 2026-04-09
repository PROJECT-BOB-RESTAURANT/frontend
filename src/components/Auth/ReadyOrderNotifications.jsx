import { useEffect, useMemo, useRef, useState } from 'react'
import { backendApi } from '../../services/backendApi'

const fallbackTableLabel = (tableObjectId) => {
  const raw = String(tableObjectId ?? '')
  if (raw.length < 4) return 'Table'
  return `T-${raw.slice(0, 4).toUpperCase()}`
}

const notificationKey = (line) => {
  const marker = line.statusUpdatedAt ?? line.createdAt ?? 0
  return `${line.id}:${marker}`
}

function ReadyOrderNotifications({ session, role, currentRestaurantId, restaurants }) {
  const [notifications, setNotifications] = useState([])

  const seenKeysRef = useRef(new Set())
  const initializedRef = useRef(false)

  const currentRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === currentRestaurantId) ?? null,
    [restaurants, currentRestaurantId],
  )

  const workers = currentRestaurant?.workers ?? []

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

  const tableLookup = useMemo(() => {
    const map = new Map()

    for (const floor of currentRestaurant?.floors ?? []) {
      for (const object of floor.objects ?? []) {
        map.set(object.id, {
          tableLabel: String(object.metadata?.label ?? '').trim() || fallbackTableLabel(object.id),
          floorName: floor.name,
        })
      }
    }

    return map
  }, [currentRestaurant])

  useEffect(() => {
    initializedRef.current = false
    seenKeysRef.current = new Set()
    setNotifications([])
  }, [currentRestaurantId, currentWorkerId, currentWorkerName])

  useEffect(() => {
    if (!currentRestaurantId) return undefined
    if (!role) return undefined

    const normalizedWorkerName = String(currentWorkerName ?? '').trim().toLowerCase()

    if (!currentWorkerId && !normalizedWorkerName) return undefined

    const belongsToCurrentWorker = (line) => {
      if (currentWorkerId && line.placedByWorkerId) {
        return line.placedByWorkerId === currentWorkerId
      }

      if (normalizedWorkerName && line.placedByWorkerName) {
        return String(line.placedByWorkerName).trim().toLowerCase() === normalizedWorkerName
      }

      return false
    }

    const syncNotifications = async (seedOnly) => {
      const lines = await backendApi.listKitchenOrderLines(currentRestaurantId)
      const fresh = []

      for (const line of lines) {
        if (line.status !== 'readyForServer') continue
        if (!belongsToCurrentWorker(line)) continue

        const key = notificationKey(line)
        if (seenKeysRef.current.has(key)) continue

        seenKeysRef.current.add(key)
        if (seedOnly) continue

        const tableInfo = tableLookup.get(line.tableObjectId)
        fresh.push({
          id: key,
          name: line.name,
          quantity: line.quantity,
          note: line.note ?? '',
          tableLabel: tableInfo?.tableLabel ?? fallbackTableLabel(line.tableObjectId),
          floorName: tableInfo?.floorName ?? line.floorName ?? 'Unknown floor',
        })
      }

      if (fresh.length > 0) {
        setNotifications((current) => [...fresh, ...current].slice(0, 8))
      }
    }

    let active = true

    const run = async (seedOnly) => {
      try {
        await syncNotifications(seedOnly)
      } catch {
        if (active) {
          return
        }
      }
    }

    if (!initializedRef.current) {
      run(true).finally(() => {
        if (active) {
          initializedRef.current = true
        }
      })
    }

    const intervalId = window.setInterval(() => {
      if (!initializedRef.current) return
      run(false)
    }, 8000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [currentRestaurantId, role, currentWorkerId, currentWorkerName, tableLookup])

  if (notifications.length === 0) return null

  return (
    <section className="fixed bottom-20 left-4 z-40 w-[min(92vw,380px)] space-y-2">
      {notifications.map((notification) => (
        <article
          key={notification.id}
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 shadow-lg"
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-900">Ready To Serve</p>
              <p className="text-sm font-semibold text-emerald-900">
                {notification.name} x{notification.quantity}
              </p>
              <p className="text-xs text-emerald-800">
                Table {notification.tableLabel} | {notification.floorName}
              </p>
              {notification.note ? (
                <p className="text-xs text-emerald-800">Note: {notification.note}</p>
              ) : null}
            </div>

            <button
              type="button"
              aria-label="Dismiss notification"
              className="ml-auto rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
              onClick={() =>
                setNotifications((current) => current.filter((item) => item.id !== notification.id))
              }
            >
              X
            </button>
          </div>
        </article>
      ))}
    </section>
  )
}

export { ReadyOrderNotifications }
