import { GRID_SIZE, clamp, snapToGrid } from '../../utils/grid'
import { getDefaultSeatsForType, isTableObjectType } from '../../utils/objectLibrary'
import { normalizeFrontendOrderLineStatus } from '../../utils/orderLineStatus'
import {
  DEFAULT_CANVAS_POSITION,
  DEFAULT_CANVAS_ZOOM,
  MAX_SCALE,
  MAX_ZOOM,
  MIN_SCALE,
  MIN_SIZE,
  MIN_ZOOM,
  WEEK_DAYS,
  createId,
} from './constants'
import {
  DEFAULT_RESERVATION_HOURS,
  findFolderById,
  normalizeMenuFolders,
  normalizeOpeningDateOverrides,
  normalizeObject,
  normalizeOpeningHours,
  normalizeOrders,
  normalizePrice,
  normalizeReservations,
  normalizeSeats,
  normalizeTime,
  normalizeWorkers,
  removeFolderRecursive,
  toDateMs,
  updateFolderRecursive,
} from './normalizers'
import {
  cloneObjects,
  createFloorModel,
  createRestaurantModel,
  loadFloorIntoEditor,
  loadRestaurantIntoWorkspace,
  persistCurrentFloor,
  persistCurrentRestaurant,
  persistRestaurantFloors,
  updateCurrentRestaurant,
} from './workspaceHelpers'

export const createFloorStoreActions = (set, get) => ({
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
    const restaurant = createRestaurantModel(name?.trim() || `Restaurant ${get().restaurants.length + 1}`)
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
      if (remaining.length === 0) {
        return {
          ...state,
          restaurants: [],
          currentRestaurantId: null,
          floors: [],
          currentFloorId: null,
          objects: [],
          selectedObjectId: null,
          waiterTableId: null,
          waiterWorkerId: null,
          page: 'restaurant-management',
        }
      }

      const nextState = loadRestaurantIntoWorkspace(
        {
          ...state,
          restaurants: remaining,
          currentRestaurantId: remaining[0].id,
        },
        remaining[0].id,
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

  openKitchenForRestaurant: (restaurantId) => {
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
        page: 'kitchen-management',
        waiterTableId: null,
        waiterWorkerId: null,
      }
    })
  },

  openReservationStatisticsForRestaurant: (restaurantId) => {
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
        page: 'reservation-statistics',
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

  switchRestaurantInKitchen: (restaurantId) => {
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
        page: 'kitchen-management',
        waiterTableId: null,
        waiterWorkerId: null,
      }
    })
  },

  switchRestaurantInReservationStatistics: (restaurantId) => {
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
        page: 'reservation-statistics',
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
    const floor = createFloorModel(name?.trim() || `Floor ${get().floors.length + 1}`, size)
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
      if (remaining.length === 0) {
        return {
          ...state,
          floors: [],
          currentFloorId: null,
          objects: [],
          selectedObjectId: null,
        }
      }

      const nextCurrentId = remaining[0].id

      const nextState = loadFloorIntoEditor(
        {
          ...state,
          floors: remaining,
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

  setReservationPreviewAt: (value) => {
    const normalizedValue = typeof value === 'string' ? value.trim() : ''
    if (!normalizedValue) {
      set({ reservationPreviewAt: null })
      return
    }

    const ms = toDateMs(normalizedValue)
    if (ms === null) {
      return
    }

    set({ reservationPreviewAt: new Date(ms).toISOString() })
  },

  setWaiterWorker: (workerId) => {
    const state = get()
    const restaurant = state.restaurants.find((item) => item.id === state.currentRestaurantId)
    if (!restaurant) return

    const workers = normalizeWorkers(restaurant.workers)
    const exists = workers.some((worker) => worker.id === workerId)
    set({ waiterWorkerId: exists ? workerId : null })
  },

  setWaiterActiveSection: (section) => {
    set({ waiterActiveSection: section === 'reservations' ? 'reservations' : 'orders' })
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

  openWaiterForTable: (tableId, section = 'orders') => {
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
      waiterActiveSection: section === 'reservations' ? 'reservations' : 'orders',
      selectedObjectId: tableId,
    })
  },

  backToEditorFromWaiter: () => {
    set({
      page: 'editor',
      editorMode: 'view',
      waiterTableId: null,
      waiterWorkerId: null,
      waiterActiveSection: 'orders',
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

    const nextStatus = normalizeFrontendOrderLineStatus(status)
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

  addWorker: (name, role = 'staff') => {
    const nextName = String(name ?? '').trim()
    const nextRole = String(role ?? '').trim() || 'staff'
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

  hydrateFromBackend: (restaurants, options = {}) => {
    set((state) => {
      const safeRestaurants = Array.isArray(restaurants)
        ? restaurants.filter((restaurant) => restaurant?.id)
        : []

      if (safeRestaurants.length === 0) {
        return {
          restaurants: [],
          currentRestaurantId: null,
          floors: [],
          currentFloorId: null,
          objects: [],
          canvasZoom: DEFAULT_CANVAS_ZOOM,
          canvasPosition: { ...DEFAULT_CANVAS_POSITION },
          selectedObjectId: null,
          waiterTableId: null,
          waiterWorkerId: null,
          page: options.page ?? 'restaurant-management',
        }
      }

      const normalizedRestaurants = safeRestaurants.map((restaurant) => {
        const floors = Array.isArray(restaurant.floors)
          ? restaurant.floors.map((floor) => ({
              ...floor,
              objects: cloneObjects(floor.objects ?? []),
              canvasZoom: floor.canvasZoom ?? DEFAULT_CANVAS_ZOOM,
              canvasPosition: floor.canvasPosition ?? { ...DEFAULT_CANVAS_POSITION },
            }))
          : []

        return {
          ...restaurant,
          floors,
          workers: normalizeWorkers(restaurant.workers),
          openingHours: normalizeOpeningHours(restaurant.openingHours),
          openingDateOverrides: normalizeOpeningDateOverrides(restaurant.openingDateOverrides),
          goodsCatalog: normalizeMenuFolders(restaurant.goodsCatalog ?? restaurant.goodsCategories),
          updatedAt: restaurant.updatedAt ?? Date.now(),
          createdAt: restaurant.createdAt ?? Date.now(),
        }
      })

      const preferredRestaurantId = options.currentRestaurantId
      const preferredFloorId = options.currentFloorId
      const nextRestaurant =
        normalizedRestaurants.find((restaurant) => restaurant.id === preferredRestaurantId) ??
        normalizedRestaurants[0]

      const workspace = loadRestaurantIntoWorkspace(
        {
          ...state,
          restaurants: normalizedRestaurants,
          currentRestaurantId: nextRestaurant.id,
        },
        nextRestaurant.id,
      )

      const floorExists = workspace.floors.some((floor) => floor.id === preferredFloorId)
      const withFloor = floorExists
        ? loadFloorIntoEditor(
            {
              ...workspace,
              floors: workspace.floors,
            },
            preferredFloorId,
          )
        : workspace

      const waiterTableExists = withFloor.objects.some((object) => object.id === options.waiterTableId)
      const selectedObjectExists = withFloor.objects.some(
        (object) => object.id === options.selectedObjectId,
      )

      return {
        ...withFloor,
        page: options.page ?? state.page,
        editorMode: options.editorMode ?? state.editorMode,
        waiterTableId: waiterTableExists ? options.waiterTableId : null,
        waiterWorkerId: options.waiterWorkerId ?? state.waiterWorkerId,
        selectedObjectId: selectedObjectExists ? options.selectedObjectId : null,
      }
    })
  },

  applyCreatedObjectIds: (idMap) => {
    if (!(idMap instanceof Map) || idMap.size === 0) return

    set((state) => {
      const remapObject = (object) => ({
        ...object,
        id: idMap.get(object.id) ?? object.id,
      })

      const remapFloor = (floor) => ({
        ...floor,
        objects: (floor.objects ?? []).map(remapObject),
      })

      const remapRestaurant = (restaurant) => ({
        ...restaurant,
        floors: (restaurant.floors ?? []).map(remapFloor),
      })

      const nextSelectedObjectId = idMap.get(state.selectedObjectId) ?? state.selectedObjectId
      const nextWaiterTableId = idMap.get(state.waiterTableId) ?? state.waiterTableId

      return {
        restaurants: state.restaurants.map(remapRestaurant),
        floors: state.floors.map(remapFloor),
        objects: state.objects.map(remapObject),
        selectedObjectId: nextSelectedObjectId,
        waiterTableId: nextWaiterTableId,
      }
    })
  },

  setTableServiceData: (tableId, payload) => {
    const table = get().objects.find((object) => object.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const nextReservations = normalizeReservations(payload?.reservations)
    const nextOrders = normalizeOrders(payload?.orders)

    get().updateObject(tableId, {
      metadata: {
        reservations: nextReservations,
        orders: nextOrders,
      },
    })
  },

  setTableReservationsData: (tableId, reservations) => {
    const table = get().objects.find((object) => object.id === tableId)
    if (!table || !isTableObjectType(table.type)) return

    const nextReservations = normalizeReservations(reservations)

    get().updateObject(tableId, {
      metadata: {
        reservations: nextReservations,
      },
    })
  },

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
              openingDateOverrides: normalizeOpeningDateOverrides(restaurant.openingDateOverrides),
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
      const legacyFloor = createFloorModel('Imported Floor')
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
      canvasZoom: floor.canvasZoom ?? DEFAULT_CANVAS_ZOOM,
      canvasPosition: floor.canvasPosition ?? { ...DEFAULT_CANVAS_POSITION },
      objects: Array.isArray(floor.objects)
        ? floor.objects.map((obj) => normalizeObject(obj))
        : [],
    }))

    const firstFloor = floors[0] ?? createFloorModel('Ground Floor')

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
          openingDateOverrides: normalizeOpeningDateOverrides(
            parsed.restaurant?.openingDateOverrides ?? restaurant.openingDateOverrides,
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
})
