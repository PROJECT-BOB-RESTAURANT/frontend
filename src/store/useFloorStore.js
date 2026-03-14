import { create } from 'zustand'
import { snapToGrid, GRID_SIZE, clamp } from '../utils/grid'
import { getDefaultSeatsForType, isTableObjectType } from '../utils/objectLibrary'
import {
  DEFAULT_RESERVATION_HOURS,
  normalizeReservations,
  toDateMs,
} from '../utils/reservations'

const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.5
const MIN_SIZE = GRID_SIZE
const MIN_SCALE = 0.4
const MAX_SCALE = 5

const createId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`

const WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const createDefaultOpeningHours = () =>
  WEEK_DAYS.map((day) => ({
    day,
    open: '09:00',
    close: '22:00',
    isClosed: false,
  }))

const normalizeTime = (value, fallback) => {
  const text = String(value ?? '').trim()
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(text) ? text : fallback
}

const normalizeOpeningHours = (hours) => {
  const defaults = createDefaultOpeningHours()
  if (!Array.isArray(hours)) return defaults

  return WEEK_DAYS.map((day) => {
    const raw = hours.find((entry) => entry?.day === day)
    const base = defaults.find((entry) => entry.day === day)

    return {
      day,
      open: normalizeTime(raw?.open, base.open),
      close: normalizeTime(raw?.close, base.close),
      isClosed: Boolean(raw?.isClosed),
    }
  })
}

const normalizeSeats = (value, fallback = 1) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.round(numeric))
}

const normalizeOrders = (orders) => {
  if (!Array.isArray(orders)) return []

  return orders
    .map((order) => {
      const name = String(order?.name ?? '').trim()
      if (!name) return null

      const quantity = Math.max(1, Math.round(Number(order?.quantity ?? 1) || 1))

      return {
        id: order?.id ?? createId('order'),
        name,
        quantity,
        unitPrice: Math.max(0, Number(order?.unitPrice ?? 0) || 0),
        note: String(order?.note ?? '').trim(),
        status: order?.status === 'served' ? 'served' : 'pending',
        placedByWorkerId: order?.placedByWorkerId ?? null,
        placedByWorkerName: order?.placedByWorkerName ?? null,
        createdAt: order?.createdAt ?? Date.now(),
      }
    })
    .filter(Boolean)
}

const normalizeManualOccupiedUntil = (value) => {
  const ms = toDateMs(value)
  return ms ? new Date(ms).toISOString() : null
}

const normalizePrice = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.round(numeric * 100) / 100)
}

const normalizeGoodsItem = (item) => {
  const name = String(item?.name ?? '').trim()
  if (!name) return null

  return {
    id: item?.id ?? createId('goods-item'),
    name,
    price: normalizePrice(item?.price),
  }
}

const normalizeMenuFolders = (folders) => {
  if (!Array.isArray(folders)) return []

  return folders
    .map((folder) => {
      const name = String(folder?.name ?? '').trim()
      if (!name) return null

      const childFolders = normalizeMenuFolders(folder?.folders ?? folder?.categories ?? [])
      const items = Array.isArray(folder?.items)
        ? folder.items.map(normalizeGoodsItem).filter(Boolean)
        : []

      return {
        id: folder?.id ?? createId('menu-folder'),
        name,
        folders: childFolders,
        items,
      }
    })
    .filter(Boolean)
}

const createDefaultMenuFolders = () => [
  {
    id: createId('menu-folder'),
    name: 'Drinks',
    folders: [
      { id: createId('menu-folder'), name: 'Alcoholic Drinks', folders: [], items: [] },
      { id: createId('menu-folder'), name: 'Soft Drinks', folders: [], items: [] },
    ],
    items: [],
  },
  {
    id: createId('menu-folder'),
    name: 'Main Dishes',
    folders: [],
    items: [],
  },
  {
    id: createId('menu-folder'),
    name: 'Soups',
    folders: [],
    items: [],
  },
]

const normalizeWorkers = (workers) => {
  if (!Array.isArray(workers)) return []

  return workers
    .map((worker) => {
      const name = String(worker?.name ?? '').trim()
      if (!name) return null

      return {
        id: worker?.id ?? createId('worker'),
        name,
        role: String(worker?.role ?? 'waiter').trim() || 'waiter',
      }
    })
    .filter(Boolean)
}

const updateFolderRecursive = (folders, folderId, updater) => {
  return folders.map((folder) => {
    if (folder.id === folderId) {
      return updater(folder)
    }

    return {
      ...folder,
      folders: updateFolderRecursive(folder.folders, folderId, updater),
    }
  })
}

const removeFolderRecursive = (folders, folderId) => {
  return folders
    .filter((folder) => folder.id !== folderId)
    .map((folder) => ({
      ...folder,
      folders: removeFolderRecursive(folder.folders, folderId),
    }))
}

const findFolderById = (folders, folderId) => {
  for (const folder of folders) {
    if (folder.id === folderId) return folder
    const nested = findFolderById(folder.folders, folderId)
    if (nested) return nested
  }

  return null
}

const normalizeObject = (obj) => {
  const fallbackScale = Number(obj.scale ?? 1)
  const tableType = isTableObjectType(obj.type)
  const defaultSeats = getDefaultSeatsForType(obj.type)
  const providedSeats = obj.metadata?.seats ?? obj.seats
  const normalizedNonTableSeats = Number.isFinite(Number(providedSeats))
    ? Math.max(0, Math.round(Number(providedSeats)))
    : 0

  return {
    id: obj.id ?? createId('obj'),
    type: obj.type,
    x: snapToGrid(obj.x ?? 0),
    y: snapToGrid(obj.y ?? 0),
    width: Math.max(MIN_SIZE, snapToGrid(obj.width ?? 80)),
    height: Math.max(MIN_SIZE, snapToGrid(obj.height ?? 80)),
    rotation: Number(obj.rotation ?? 0),
    scaleX: clamp(Number(obj.scaleX ?? fallbackScale), MIN_SCALE, MAX_SCALE),
    scaleY: clamp(Number(obj.scaleY ?? fallbackScale), MIN_SCALE, MAX_SCALE),
    metadata: {
      ...obj.metadata,
      seats: tableType ? normalizeSeats(providedSeats, defaultSeats) : normalizedNonTableSeats,
      label: obj.metadata?.label ?? obj.label ?? obj.type,
      anchor: obj.metadata?.anchor ?? 'top-left',
      fillColor: obj.metadata?.fillColor ?? null,
      strokeColor: obj.metadata?.strokeColor ?? null,
      orders: normalizeOrders(obj.metadata?.orders),
      reservations: normalizeReservations(obj.metadata?.reservations),
      manualOccupiedUntil: normalizeManualOccupiedUntil(obj.metadata?.manualOccupiedUntil),
    },
  }
}

const createFloor = (name, size) => ({
  id: createId('floor'),
  name,
  objects: [],
  size: size ?? null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  canvasZoom: 1,
  canvasPosition: { x: 160, y: 90 },
})

const cloneFloor = (floor) => ({
  ...floor,
  objects: cloneObjects(floor.objects ?? []),
  canvasPosition: { ...(floor.canvasPosition ?? { x: 160, y: 90 }) },
})

const createRestaurant = (name) => {
  const defaultFloor = createFloor('Ground Floor')

  return {
    id: createId('restaurant'),
    name,
    floors: [defaultFloor],
    goodsCatalog: createDefaultMenuFolders(),
    workers: [],
    openingHours: createDefaultOpeningHours(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

const cloneObjects = (objects) => objects.map((obj) => ({ ...obj, metadata: { ...obj.metadata } }))

const persistRestaurantFloors = (restaurants, restaurantId, floors) => {
  return restaurants.map((restaurant) => {
    if (restaurant.id !== restaurantId) return restaurant

    return {
      ...restaurant,
      floors: floors.map(cloneFloor),
      updatedAt: Date.now(),
    }
  })
}

const updateCurrentRestaurant = (state, updater) => {
  return state.restaurants.map((restaurant) => {
    if (restaurant.id !== state.currentRestaurantId) return restaurant

    const nextRestaurant = updater(restaurant)
    return {
      ...nextRestaurant,
      updatedAt: Date.now(),
    }
  })
}

const persistCurrentFloor = (state) => {
  if (!state.currentFloorId) return state.floors

  return state.floors.map((floor) => {
    if (floor.id !== state.currentFloorId) return floor

    return {
      ...floor,
      objects: cloneObjects(state.objects),
      canvasZoom: state.canvasZoom,
      canvasPosition: { ...state.canvasPosition },
      updatedAt: Date.now(),
    }
  })
}

const loadFloorIntoEditor = (state, floorId) => {
  const floor = state.floors.find((item) => item.id === floorId)
  if (!floor) return state

  return {
    ...state,
    currentFloorId: floor.id,
    objects: cloneObjects(floor.objects),
    canvasZoom: floor.canvasZoom ?? 1,
    canvasPosition: floor.canvasPosition ?? { x: 160, y: 90 },
    selectedObjectId: null,
  }
}

const defaultRestaurant = createRestaurant('Main Restaurant')

const persistCurrentRestaurant = (state) => {
  if (!state.currentRestaurantId) return state.restaurants

  const persistedFloors = persistCurrentFloor(state)
  return persistRestaurantFloors(state.restaurants, state.currentRestaurantId, persistedFloors)
}

const loadRestaurantIntoWorkspace = (state, restaurantId) => {
  const restaurant = state.restaurants.find((item) => item.id === restaurantId)
  if (!restaurant) return state

  const floors = restaurant.floors.length > 0 ? restaurant.floors.map(cloneFloor) : [createFloor('Ground Floor')]
  const firstFloor = floors[0]

  return {
    ...state,
    currentRestaurantId: restaurant.id,
    floors,
    currentFloorId: firstFloor.id,
    objects: cloneObjects(firstFloor.objects ?? []),
    canvasZoom: firstFloor.canvasZoom ?? 1,
    canvasPosition: firstFloor.canvasPosition ?? { x: 160, y: 90 },
    selectedObjectId: null,
  }
}

export const useFloorStore = create((set, get) => ({
  page: 'restaurant-management',
  editorMode: 'edit',
  waiterTableId: null,
  waiterWorkerId: null,
  restaurants: [defaultRestaurant],
  currentRestaurantId: defaultRestaurant.id,
  floors: [cloneFloor(defaultRestaurant.floors[0])],
  currentFloorId: defaultRestaurant.floors[0].id,

  objects: [],
  selectedObjectId: null,
  canvasZoom: 1,
  canvasPosition: { x: 160, y: 90 },
  snapEnabled: true,

  setSnapEnabled: (enabled) => set({ snapEnabled: Boolean(enabled) }),
  setSelectedObject: (id) => set({ selectedObjectId: id }),

  openGuestReservationPage: () => {
    set((state) => ({
      restaurants: persistCurrentRestaurant(state),
      page: 'guest-reservation',
      waiterTableId: null,
      waiterWorkerId: null,
      selectedObjectId: null,
    }))
  },

  backToRestaurantManagement: () => {
    set((state) => ({
      restaurants: persistCurrentRestaurant(state),
      page: 'restaurant-management',
      waiterTableId: null,
      waiterWorkerId: null,
      selectedObjectId: null,
    }))
  },

  createGuestReservation: ({ restaurantId, floorId, tableId, guestName, partySize, startAt, endAt, note }) => {
    if (!restaurantId || !floorId || !tableId) return false

    const startMs = toDateMs(startAt) ?? Date.now()
    const explicitEndMs = toDateMs(endAt)
    const computedEndMs = startMs + DEFAULT_RESERVATION_HOURS * 60 * 60 * 1000
    const endMs = explicitEndMs && explicitEndMs > startMs ? explicitEndMs : computedEndMs

    const nextReservation = {
      id: `res_${crypto.randomUUID().slice(0, 8)}`,
      guestName: String(guestName ?? '').trim() || 'Guest Reservation',
      partySize: Math.max(1, Math.round(Number(partySize ?? 1) || 1)),
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(endMs).toISOString(),
      note: String(note ?? '').trim(),
    }

    let created = false

    set((state) => {
      const persistedRestaurants = persistCurrentRestaurant(state)

      const updateObjects = (objects) =>
        objects.map((obj) => {
          if (obj.id !== tableId || !isTableObjectType(obj.type)) return obj

          created = true
          const nextReservations = normalizeReservations([
            ...(obj.metadata?.reservations ?? []),
            nextReservation,
          ])

          return {
            ...obj,
            metadata: {
              ...obj.metadata,
              reservations: nextReservations,
            },
          }
        })

      const restaurants = persistedRestaurants.map((restaurant) => {
        if (restaurant.id !== restaurantId) return restaurant

        return {
          ...restaurant,
          floors: restaurant.floors.map((floor) =>
            floor.id === floorId
              ? {
                  ...floor,
                  objects: updateObjects(floor.objects ?? []),
                  updatedAt: Date.now(),
                }
              : floor,
          ),
          updatedAt: Date.now(),
        }
      })

      const floors =
        state.currentRestaurantId === restaurantId
          ? state.floors.map((floor) =>
              floor.id === floorId
                ? {
                    ...floor,
                    objects: updateObjects(floor.objects ?? []),
                    updatedAt: Date.now(),
                  }
                : floor,
            )
          : state.floors

      const objects =
        state.currentRestaurantId === restaurantId && state.currentFloorId === floorId
          ? updateObjects(state.objects)
          : state.objects

      return {
        restaurants,
        floors,
        objects,
      }
    })

    return created
  },

  createRestaurant: (name) => {
    const restaurant = createRestaurant(name?.trim() || `Restaurant ${get().restaurants.length + 1}`)
    set((state) => ({
      restaurants: [...persistCurrentRestaurant(state), restaurant],
    }))

    return restaurant.id
  },

  renameRestaurant: (restaurantId, name) => {
    const nextName = name?.trim()
    if (!nextName) return

    set((state) => ({
      restaurants: state.restaurants.map((restaurant) =>
        restaurant.id === restaurantId
          ? {
              ...restaurant,
              name: nextName,
              updatedAt: Date.now(),
            }
          : restaurant,
      ),
    }))
  },

  deleteRestaurant: (restaurantId) => {
    set((state) => {
      const persistedRestaurants = persistCurrentRestaurant(state)
      const remaining = persistedRestaurants.filter((restaurant) => restaurant.id !== restaurantId)
      const nextRestaurants =
        remaining.length > 0 ? remaining : [createRestaurant('Main Restaurant')]

      const nextState = loadRestaurantIntoWorkspace(
        {
          ...state,
          restaurants: nextRestaurants,
          currentRestaurantId: nextRestaurants[0].id,
        },
        nextRestaurants[0].id,
      )

      return {
        ...nextState,
        page: 'restaurant-management',
      }
    })
  },

  openRestaurant: (restaurantId) => {
    set((state) => {
      const persistedRestaurants = persistCurrentRestaurant(state)
      const nextState = loadRestaurantIntoWorkspace(
        {
          ...state,
          restaurants: persistedRestaurants,
        },
        restaurantId,
      )

      return {
        ...nextState,
        page: 'management',
        waiterTableId: null,
        waiterWorkerId: null,
      }
    })
  },

  switchRestaurantInManagement: (restaurantId) => {
    set((state) => {
      const persistedRestaurants = persistCurrentRestaurant(state)
      const nextState = loadRestaurantIntoWorkspace(
        {
          ...state,
          restaurants: persistedRestaurants,
        },
        restaurantId,
      )

      return {
        ...nextState,
        page: 'management',
        waiterTableId: null,
        waiterWorkerId: null,
      }
    })
  },

  switchRestaurantInEditor: (restaurantId) => {
    set((state) => {
      const persistedRestaurants = persistCurrentRestaurant(state)
      const nextState = loadRestaurantIntoWorkspace(
        {
          ...state,
          restaurants: persistedRestaurants,
        },
        restaurantId,
      )

      return {
        ...nextState,
        page: 'editor',
        waiterTableId: null,
        waiterWorkerId: null,
      }
    })
  },

  backToRestaurants: () => {
    set((state) => ({
      restaurants: persistCurrentRestaurant(state),
      page: 'restaurant-management',
      selectedObjectId: null,
      waiterTableId: null,
      waiterWorkerId: null,
    }))
  },

  createFloor: (name, size) => {
    const floor = createFloor(name?.trim() || `Floor ${get().floors.length + 1}`, size)
    set((state) => ({
      floors: [...state.floors, floor],
    }))
    return floor.id
  },

  renameFloor: (floorId, name) => {
    const nextName = name?.trim()
    if (!nextName) return

    set((state) => ({
      floors: state.floors.map((floor) =>
        floor.id === floorId
          ? {
              ...floor,
              name: nextName,
              updatedAt: Date.now(),
            }
          : floor,
      ),
    }))
  },

  deleteFloor: (floorId) => {
    set((state) => {
      const persistedFloors = persistCurrentFloor(state)
      const remaining = persistedFloors.filter((floor) => floor.id !== floorId)
      const nextFloors = remaining.length > 0 ? remaining : [createFloor('Ground Floor')]
      const nextCurrentId = nextFloors[0].id

      const nextState = loadFloorIntoEditor(
        {
          ...state,
          floors: nextFloors,
          currentFloorId: nextCurrentId,
        },
        nextCurrentId,
      )

      return {
        ...nextState,
      }
    })
  },

  openFloor: (floorId, mode = 'edit') => {
    set((state) => {
      const persistedFloors = persistCurrentFloor(state)
      const nextState = loadFloorIntoEditor(
        {
          ...state,
          floors: persistedFloors,
        },
        floorId,
      )

      return {
        ...nextState,
        page: 'editor',
        editorMode: mode,
        waiterTableId: null,
        waiterWorkerId: null,
      }
    })
  },

  backToManagement: () => {
    set((state) => ({
      floors: persistCurrentFloor(state),
      page: 'management',
      selectedObjectId: null,
      waiterTableId: null,
      waiterWorkerId: null,
    }))
  },

  switchFloorInEditor: (floorId) => {
    set((state) => {
      const persistedFloors = persistCurrentFloor(state)
      return loadFloorIntoEditor(
        {
          ...state,
          floors: persistedFloors,
        },
        floorId,
      )
    })
  },

  setEditorMode: (mode) => set({ editorMode: mode }),

  setWaiterWorker: (workerId) => {
    const state = get()
    const restaurant = state.restaurants.find((item) => item.id === state.currentRestaurantId)
    if (!restaurant) return

    const workers = normalizeWorkers(restaurant.workers)
    const exists = workers.some((worker) => worker.id === workerId)
    set({ waiterWorkerId: exists ? workerId : null })
  },

  updateOpeningHoursDay: (day, updates) => {
    const nextDay = String(day ?? '').trim()
    if (!WEEK_DAYS.includes(nextDay)) return

    set((state) => ({
      restaurants: updateCurrentRestaurant(state, (restaurant) => {
        const currentHours = normalizeOpeningHours(restaurant.openingHours)

        return {
          ...restaurant,
          openingHours: currentHours.map((entry) => {
            if (entry.day !== nextDay) return entry

            return {
              ...entry,
              open:
                updates?.open !== undefined
                  ? normalizeTime(updates.open, entry.open)
                  : entry.open,
              close:
                updates?.close !== undefined
                  ? normalizeTime(updates.close, entry.close)
                  : entry.close,
              isClosed:
                updates?.isClosed !== undefined
                  ? Boolean(updates.isClosed)
                  : entry.isClosed,
            }
          }),
        }
      }),
    }))
  },

  openWaiterForTable: (tableId) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const state = get()
    const restaurant = state.restaurants.find((item) => item.id === state.currentRestaurantId)
    const workers = normalizeWorkers(restaurant?.workers)
    const hasCurrentWorker = workers.some((worker) => worker.id === state.waiterWorkerId)
    const fallbackWorkerId = hasCurrentWorker ? state.waiterWorkerId : workers[0]?.id ?? null

    set({
      page: 'waiter-management',
      waiterTableId: tableId,
      waiterWorkerId: fallbackWorkerId,
      selectedObjectId: tableId,
    })
  },

  backToEditorFromWaiter: () => {
    set({
      page: 'editor',
      editorMode: 'view',
      waiterTableId: null,
      waiterWorkerId: null,
    })
  },

  addOrderToTable: (tableId, orderName, note = '', unitPrice = 0) => {
    const name = String(orderName ?? '').trim()
    if (!name) return

    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const state = get()
    const restaurant = state.restaurants.find((item) => item.id === state.currentRestaurantId)
    const worker = normalizeWorkers(restaurant?.workers).find(
      (entry) => entry.id === state.waiterWorkerId,
    )

    const existingOrders = normalizeOrders(table.metadata?.orders)
    const nextOrder = {
      id: createId('order'),
      name,
      quantity: 1,
      unitPrice: normalizePrice(unitPrice),
      note: String(note ?? '').trim(),
      status: 'pending',
      placedByWorkerId: worker?.id ?? null,
      placedByWorkerName: worker?.name ?? null,
      createdAt: Date.now(),
    }

    get().updateObject(tableId, {
      metadata: {
        orders: [...existingOrders, nextOrder],
      },
    })

    return nextOrder.id
  },

  setOrderWorker: (tableId, orderId, workerId) => {
    const state = get()
    const table = state.objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const restaurant = state.restaurants.find((item) => item.id === state.currentRestaurantId)
    const workers = normalizeWorkers(restaurant?.workers)
    const selectedWorker = workers.find((worker) => worker.id === workerId)

    const nextOrders = normalizeOrders(table.metadata?.orders).map((order) =>
      order.id === orderId
        ? {
            ...order,
            placedByWorkerId: selectedWorker?.id ?? null,
            placedByWorkerName: selectedWorker?.name ?? null,
          }
        : order,
    )

    get().updateObject(tableId, {
      metadata: {
        orders: nextOrders,
      },
    })
  },

  incrementOrderQuantity: (tableId, orderId) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const nextOrders = normalizeOrders(table.metadata?.orders).map((order) =>
      order.id === orderId
        ? {
            ...order,
            quantity: order.quantity + 1,
          }
        : order,
    )

    get().updateObject(tableId, {
      metadata: {
        orders: nextOrders,
      },
    })
  },

  decrementOrderQuantity: (tableId, orderId) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const nextOrders = normalizeOrders(table.metadata?.orders)
      .map((order) =>
        order.id === orderId
          ? {
              ...order,
              quantity: order.quantity - 1,
            }
          : order,
      )
      .filter((order) => order.quantity > 0)

    get().updateObject(tableId, {
      metadata: {
        orders: nextOrders,
      },
    })
  },

  setOrderStatus: (tableId, orderId, status) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const nextStatus = status === 'served' ? 'served' : 'pending'
    const nextOrders = normalizeOrders(table.metadata?.orders).map((order) =>
      order.id === orderId
        ? {
            ...order,
            status: nextStatus,
          }
        : order,
    )

    get().updateObject(tableId, {
      metadata: {
        orders: nextOrders,
      },
    })
  },

  setOrderUnitPrice: (tableId, orderId, unitPrice) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const nextOrders = normalizeOrders(table.metadata?.orders).map((order) =>
      order.id === orderId
        ? {
            ...order,
            unitPrice: normalizePrice(unitPrice),
          }
        : order,
    )

    get().updateObject(tableId, {
      metadata: {
        orders: nextOrders,
      },
    })
  },

  removeOrderFromTable: (tableId, orderId) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const nextOrders = normalizeOrders(table.metadata?.orders).filter((order) => order.id !== orderId)

    get().updateObject(tableId, {
      metadata: {
        orders: nextOrders,
      },
    })
  },

  clearTableOrders: (tableId) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    get().updateObject(tableId, {
      metadata: {
        orders: [],
      },
    })
  },

  addTableReservation: (tableId, reservationInput) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const guestName =
      String(reservationInput?.guestName ?? '').trim() || 'Reservation'
    const partySize = Math.max(1, Math.round(Number(reservationInput?.partySize ?? 1) || 1))
    const startMs = toDateMs(reservationInput?.startAt) ?? Date.now()
    const explicitEndMs = toDateMs(reservationInput?.endAt)
    const durationHours = Number(reservationInput?.durationHours)
    const safeDurationHours =
      Number.isFinite(durationHours) && durationHours > 0
        ? durationHours
        : DEFAULT_RESERVATION_HOURS
    const computedEndMs = startMs + safeDurationHours * 60 * 60 * 1000
    const endMs = explicitEndMs && explicitEndMs > startMs ? explicitEndMs : computedEndMs

    const nextReservation = {
      id: `res_${crypto.randomUUID().slice(0, 8)}`,
      guestName,
      partySize,
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(endMs).toISOString(),
      note: String(reservationInput?.note ?? '').trim(),
    }

    const nextReservations = normalizeReservations([
      ...(table.metadata?.reservations ?? []),
      nextReservation,
    ])

    get().updateObject(tableId, {
      metadata: {
        reservations: nextReservations,
      },
    })
  },

  removeTableReservation: (tableId, reservationId) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const nextReservations = normalizeReservations(table.metadata?.reservations).filter(
      (reservation) => reservation.id !== reservationId,
    )

    get().updateObject(tableId, {
      metadata: {
        reservations: nextReservations,
      },
    })
  },

  extendTableReservation: (tableId, reservationId, minutes = 30) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const extraMs = Math.max(1, Math.round(Number(minutes) || 30)) * 60 * 1000
    const nextReservations = normalizeReservations(table.metadata?.reservations).map(
      (reservation) => {
        if (reservation.id !== reservationId) return reservation

        const currentEndMs = toDateMs(reservation.endAt) ?? Date.now()
        return {
          ...reservation,
          endAt: new Date(currentEndMs + extraMs).toISOString(),
        }
      },
    )

    get().updateObject(tableId, {
      metadata: {
        reservations: nextReservations,
      },
    })
  },

  setTableManualOccupied: (tableId, minutes = 180) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const durationMs = Math.max(1, Math.round(Number(minutes) || 180)) * 60 * 1000
    const until = new Date(Date.now() + durationMs).toISOString()

    get().updateObject(tableId, {
      metadata: {
        manualOccupiedUntil: until,
      },
    })
  },

  extendTableManualOccupied: (tableId, minutes = 30) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const durationMs = Math.max(1, Math.round(Number(minutes) || 30)) * 60 * 1000
    const currentUntilMs = toDateMs(table.metadata?.manualOccupiedUntil)
    const baseMs = currentUntilMs && currentUntilMs > Date.now() ? currentUntilMs : Date.now()
    const until = new Date(baseMs + durationMs).toISOString()

    get().updateObject(tableId, {
      metadata: {
        manualOccupiedUntil: until,
      },
    })
  },

  clearTableManualOccupied: (tableId) => {
    const table = get().objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    get().updateObject(tableId, {
      metadata: {
        manualOccupiedUntil: null,
      },
    })
  },

  addWorker: (name, role = 'waiter') => {
    const nextName = String(name ?? '').trim()
    const nextRole = String(role ?? '').trim() || 'waiter'
    if (!nextName) return

    set((state) => ({
      restaurants: updateCurrentRestaurant(state, (restaurant) => ({
        ...restaurant,
        workers: [
          ...normalizeWorkers(restaurant.workers),
          {
            id: createId('worker'),
            name: nextName,
            role: nextRole,
          },
        ],
      })),
    }))
  },

  updateWorker: (workerId, updates) => {
    set((state) => ({
      restaurants: updateCurrentRestaurant(state, (restaurant) => ({
        ...restaurant,
        workers: normalizeWorkers(restaurant.workers).map((worker) => {
          if (worker.id !== workerId) return worker

          return {
            ...worker,
            name:
              updates?.name !== undefined
                ? String(updates.name).trim() || worker.name
                : worker.name,
            role:
              updates?.role !== undefined
                ? String(updates.role).trim() || worker.role
                : worker.role,
          }
        }),
      })),
    }))
  },

  deleteWorker: (workerId) => {
    set((state) => {
      const restaurants = updateCurrentRestaurant(state, (restaurant) => ({
        ...restaurant,
        workers: normalizeWorkers(restaurant.workers).filter((worker) => worker.id !== workerId),
      }))

      return {
        restaurants,
        waiterWorkerId: state.waiterWorkerId === workerId ? null : state.waiterWorkerId,
      }
    })
  },

  addMenuFolder: (parentFolderId, name) => {
    const nextName = String(name ?? '').trim()
    if (!nextName) return

    set((state) => ({
      restaurants: updateCurrentRestaurant(state, (restaurant) => {
        const baseFolders = normalizeMenuFolders(restaurant.goodsCatalog ?? restaurant.goodsCategories)
        if (!parentFolderId) {
          return {
            ...restaurant,
            goodsCatalog: [
              ...baseFolders,
              { id: createId('menu-folder'), name: nextName, folders: [], items: [] },
            ],
          }
        }

        return {
          ...restaurant,
          goodsCatalog: updateFolderRecursive(baseFolders, parentFolderId, (folder) => ({
            ...folder,
            folders: [
              ...folder.folders,
              { id: createId('menu-folder'), name: nextName, folders: [], items: [] },
            ],
          })),
        }
      }),
    }))
  },

  renameMenuFolder: (folderId, name) => {
    const nextName = String(name ?? '').trim()
    if (!nextName) return

    set((state) => ({
      restaurants: updateCurrentRestaurant(state, (restaurant) => ({
        ...restaurant,
        goodsCatalog: updateFolderRecursive(
          normalizeMenuFolders(restaurant.goodsCatalog ?? restaurant.goodsCategories),
          folderId,
          (folder) => ({
            ...folder,
            name: nextName,
          }),
        ),
      })),
    }))
  },

  deleteMenuFolder: (folderId) => {
    set((state) => ({
      restaurants: updateCurrentRestaurant(state, (restaurant) => ({
        ...restaurant,
        goodsCatalog: removeFolderRecursive(
          normalizeMenuFolders(restaurant.goodsCatalog ?? restaurant.goodsCategories),
          folderId,
        ),
      })),
    }))
  },

  addMenuItem: (folderId, itemName, price) => {
    const nextName = String(itemName ?? '').trim()
    if (!nextName) return

    set((state) => ({
      restaurants: updateCurrentRestaurant(state, (restaurant) => ({
        ...restaurant,
        goodsCatalog: updateFolderRecursive(
          normalizeMenuFolders(restaurant.goodsCatalog ?? restaurant.goodsCategories),
          folderId,
          (folder) => ({
            ...folder,
            items: [
              ...folder.items,
              {
                id: createId('goods-item'),
                name: nextName,
                price: normalizePrice(price),
              },
            ],
          }),
        ),
      })),
    }))
  },

  updateMenuItem: (folderId, itemId, updates) => {
    set((state) => ({
      restaurants: updateCurrentRestaurant(state, (restaurant) => ({
        ...restaurant,
        goodsCatalog: updateFolderRecursive(
          normalizeMenuFolders(restaurant.goodsCatalog ?? restaurant.goodsCategories),
          folderId,
          (folder) => ({
            ...folder,
            items: folder.items.map((item) => {
              if (item.id !== itemId) return item

              return {
                ...item,
                name:
                  updates?.name !== undefined
                    ? String(updates.name).trim() || item.name
                    : item.name,
                price:
                  updates?.price !== undefined ? normalizePrice(updates.price) : item.price,
              }
            }),
          }),
        ),
      })),
    }))
  },

  deleteMenuItem: (folderId, itemId) => {
    set((state) => ({
      restaurants: updateCurrentRestaurant(state, (restaurant) => ({
        ...restaurant,
        goodsCatalog: updateFolderRecursive(
          normalizeMenuFolders(restaurant.goodsCatalog ?? restaurant.goodsCategories),
          folderId,
          (folder) => ({
            ...folder,
            items: folder.items.filter((item) => item.id !== itemId),
          }),
        ),
      })),
    }))
  },

  addCatalogItemOrderToTable: (tableId, folderId, itemId, note = '') => {
    const state = get()
    const table = state.objects.find((obj) => obj.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const currentRestaurant = state.restaurants.find(
      (restaurant) => restaurant.id === state.currentRestaurantId,
    )
    if (!currentRestaurant) return

    const worker = normalizeWorkers(currentRestaurant.workers).find(
      (entry) => entry.id === state.waiterWorkerId,
    )

    const catalog = normalizeMenuFolders(currentRestaurant.goodsCatalog ?? currentRestaurant.goodsCategories)
    const folder = findFolderById(catalog, folderId)
    if (!folder) return

    const item = folder.items.find((entry) => entry.id === itemId)
    if (!item) return

    const existingOrders = normalizeOrders(table.metadata?.orders)
    const nextOrder = {
      id: createId('order'),
      name: item.name,
      quantity: 1,
      unitPrice: normalizePrice(item.price),
      note: String(note ?? '').trim(),
      status: 'pending',
      placedByWorkerId: worker?.id ?? null,
      placedByWorkerName: worker?.name ?? null,
      createdAt: Date.now(),
    }

    get().updateObject(tableId, {
      metadata: {
        orders: [...existingOrders, nextOrder],
      },
    })
  },

  addObjectFromPreset: (preset, x, y) => {
    const snapEnabled = get().snapEnabled
    const object = normalizeObject({
      ...preset.config,
      x: snapEnabled ? snapToGrid(x) : x,
      y: snapEnabled ? snapToGrid(y) : y,
    })

    set((state) => ({
      objects: [...state.objects, object],
      selectedObjectId: object.id,
    }))

    return object.id
  },

  updateObject: (id, updates) => {
    const snapEnabled = get().snapEnabled
    const normalizedUpdates = { ...updates }

    if (normalizedUpdates.metadata?.seats !== undefined) {
      const currentType = get().objects.find((item) => item.id === id)?.type
      const defaultSeats = currentType ? getDefaultSeatsForType(currentType) : 1
      const nextSeats = isTableObjectType(currentType)
        ? normalizeSeats(normalizedUpdates.metadata.seats, defaultSeats)
        : Math.max(0, Math.round(Number(normalizedUpdates.metadata.seats) || 0))
      normalizedUpdates.metadata = {
        ...normalizedUpdates.metadata,
        seats: nextSeats,
      }
    }

    if (normalizedUpdates.scale !== undefined) {
      normalizedUpdates.scaleX = normalizedUpdates.scale
      normalizedUpdates.scaleY = normalizedUpdates.scale
      delete normalizedUpdates.scale
    }

    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== id) return obj

        const next = {
          ...obj,
          ...normalizedUpdates,
          metadata: {
            ...obj.metadata,
            ...normalizedUpdates.metadata,
          },
        }

        return {
          ...next,
          x:
            normalizedUpdates.x !== undefined
              ? snapEnabled
                ? snapToGrid(next.x)
                : next.x
              : next.x,
          y:
            normalizedUpdates.y !== undefined
              ? snapEnabled
                ? snapToGrid(next.y)
                : next.y
              : next.y,
          width:
            normalizedUpdates.width !== undefined
              ? Math.max(MIN_SIZE, snapEnabled ? snapToGrid(next.width) : next.width)
              : next.width,
          height:
            normalizedUpdates.height !== undefined
              ? Math.max(MIN_SIZE, snapEnabled ? snapToGrid(next.height) : next.height)
              : next.height,
          rotation:
            normalizedUpdates.rotation !== undefined ? Number(next.rotation) : obj.rotation,
          scaleX:
            normalizedUpdates.scaleX !== undefined
              ? clamp(Number(next.scaleX), MIN_SCALE, MAX_SCALE)
              : obj.scaleX,
          scaleY:
            normalizedUpdates.scaleY !== undefined
              ? clamp(Number(next.scaleY), MIN_SCALE, MAX_SCALE)
              : obj.scaleY,
        }
      }),
    }))
  },

  moveObjectByDelta: (id, dx, dy) => {
    const object = get().objects.find((item) => item.id === id)
    if (!object) return

    get().updateObject(id, {
      x: object.x + dx,
      y: object.y + dy,
    })
  },

  deleteSelectedObject: () => {
    if (get().editorMode !== 'edit') return

    const selectedObjectId = get().selectedObjectId
    if (!selectedObjectId) return

    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== selectedObjectId),
      selectedObjectId: null,
    }))
  },

  duplicateSelectedObject: () => {
    if (get().editorMode !== 'edit') return

    const selectedObjectId = get().selectedObjectId
    if (!selectedObjectId) return

    const source = get().objects.find((obj) => obj.id === selectedObjectId)
    if (!source) return

    const duplicated = normalizeObject({
      ...source,
      id: createId('obj'),
      x: source.x + GRID_SIZE * 2,
      y: source.y + GRID_SIZE * 2,
      metadata: {
        ...source.metadata,
        label: `${source.metadata?.label ?? source.type} Copy`,
      },
    })

    set((state) => ({
      objects: [...state.objects, duplicated],
      selectedObjectId: duplicated.id,
    }))
  },

  setCanvasZoom: (zoom) => set({ canvasZoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) }),

  panCanvasBy: (dx, dy) => {
    set((state) => ({
      canvasPosition: {
        x: state.canvasPosition.x + dx,
        y: state.canvasPosition.y + dy,
      },
    }))
  },

  setCanvasPosition: (next) => set({ canvasPosition: next }),

  clearSelection: () => set({ selectedObjectId: null }),

  exportLayout: () => {
    const state = get()
    const persistedFloors = persistCurrentFloor(state)
    const restaurant = state.restaurants.find((item) => item.id === state.currentRestaurantId)

    return JSON.stringify(
      {
        restaurant: restaurant
          ? {
              id: restaurant.id,
              name: restaurant.name,
              workers: normalizeWorkers(restaurant.workers),
              goodsCatalog: normalizeMenuFolders(restaurant.goodsCatalog ?? restaurant.goodsCategories),
              openingHours: normalizeOpeningHours(restaurant.openingHours),
            }
          : null,
        floors: persistedFloors.map((floor) => ({
          id: floor.id,
          name: floor.name,
          size: floor.size ?? null,
          createdAt: floor.createdAt,
          updatedAt: floor.updatedAt,
          objects: floor.objects.map((obj) => ({
            id: obj.id,
            type: obj.type,
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
            rotation: obj.rotation,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            seats: obj.metadata?.seats ?? 0,
            label: obj.metadata?.label ?? '',
            metadata: obj.metadata,
          })),
        })),
      },
      null,
      2,
    )
  },

  loadLayout: (payload) => {
    const parsed = JSON.parse(payload)

    if (Array.isArray(parsed.objects)) {
      // Backward compatibility for single-floor schema
      const legacyFloor = createFloor('Imported Floor')
      legacyFloor.objects = parsed.objects.map((obj) => normalizeObject(obj))
      legacyFloor.updatedAt = Date.now()

      const state = get()
      const restaurants = persistRestaurantFloors(
        state.restaurants,
        state.currentRestaurantId,
        [legacyFloor],
      )

      set({
        restaurants,
        floors: [legacyFloor],
        currentFloorId: legacyFloor.id,
        objects: cloneObjects(legacyFloor.objects),
        selectedObjectId: null,
      })
      return
    }

    if (!Array.isArray(parsed.floors)) {
      throw new Error('Layout JSON must include a floors array')
    }

    const floors = parsed.floors.map((floor, index) => ({
      id: floor.id ?? createId('floor'),
      name: floor.name ?? `Floor ${index + 1}`,
      size: floor.size ?? null,
      createdAt: floor.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      canvasZoom: floor.canvasZoom ?? 1,
      canvasPosition: floor.canvasPosition ?? { x: 160, y: 90 },
      objects: Array.isArray(floor.objects)
        ? floor.objects.map((obj) => normalizeObject(obj))
        : [],
    }))

    const firstFloor = floors[0] ?? createFloor('Ground Floor')

    const state = get()
    const restaurants = persistRestaurantFloors(state.restaurants, state.currentRestaurantId, floors).map(
      (restaurant) => {
        if (restaurant.id !== state.currentRestaurantId) return restaurant

        return {
          ...restaurant,
          workers: normalizeWorkers(parsed.restaurant?.workers ?? restaurant.workers),
          goodsCatalog: normalizeMenuFolders(
            parsed.restaurant?.goodsCatalog ??
              parsed.restaurant?.goodsCategories ??
              restaurant.goodsCatalog ??
              restaurant.goodsCategories,
          ),
          openingHours: normalizeOpeningHours(
            parsed.restaurant?.openingHours ?? restaurant.openingHours,
          ),
        }
      },
    )

    set({
      restaurants,
      floors: floors.length > 0 ? floors : [firstFloor],
      currentFloorId: firstFloor.id,
      objects: cloneObjects(firstFloor.objects),
      canvasZoom: firstFloor.canvasZoom,
      canvasPosition: firstFloor.canvasPosition,
      selectedObjectId: null,
    })
  },
}))
