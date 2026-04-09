import {
  orderLineStatusToBackend,
  orderLineStatusToFrontend,
} from '../utils/orderLineStatus'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')
const AUTH_STORAGE_KEY = 'bob.auth.session'

const WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const workerRoleToFrontend = (role) => {
  const normalized = String(role ?? '').trim().toUpperCase()
  if (normalized === 'ADMIN' || normalized === 'MANAGER' || normalized === 'STAFF') {
    return normalized.toLowerCase()
  }
  return 'staff'
}
const workerRoleToBackend = (role) => {
  const normalized = String(role ?? '').trim().toUpperCase()
  if (normalized === 'ADMIN' || normalized === 'MANAGER' || normalized === 'STAFF') return normalized
  return 'STAFF'
}

const parseJsonSafely = (value, fallback) => {
  if (typeof value !== 'string' || !value.trim()) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const extractEnvelopeData = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data
  return payload
}

const extractErrorMessage = (payload, fallback) => {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (typeof payload?.error?.message === 'string' && payload.error.message) return payload.error.message
  if (typeof payload?.error?.code === 'string' && payload.error.code) return payload.error.code
  if (typeof payload?.message === 'string' && payload.message) return payload.message
  if (typeof payload?.error === 'string' && payload.error) return payload.error
  if (typeof payload?.detail === 'string' && payload.detail) return payload.detail
  return fallback
}

const parseStoredSession = () => {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const token = String(parsed.token ?? '').trim()
    const tokenType = String(parsed.tokenType ?? 'Bearer').trim() || 'Bearer'
    const userId = parsed.userId ? String(parsed.userId) : null
    const username = String(parsed.username ?? '').trim()
    const role = parsed.role ? String(parsed.role) : null
    const expiresAtRaw = parsed.expiresAt ? String(parsed.expiresAt) : null
    let expiresAt = null
    if (expiresAtRaw) {
      const expiresAtDate = new Date(expiresAtRaw)
      if (Number.isNaN(expiresAtDate.getTime())) return null
      expiresAt = expiresAtDate.toISOString()
    }
    if (!token || !username) return null
    if (expiresAt && Date.now() >= new Date(expiresAt).getTime()) return null
    return { token, tokenType, expiresAt, userId, username, role }
  } catch {
    return null
  }
}

const authHeaderFromSession = () => {
  const session = parseStoredSession()
  if (!session) return null
  return `${session.tokenType} ${session.token}`
}

const setAuthSession = ({ token, tokenType = 'Bearer', expiresAt = null, userId = null, username, role }) => {
  if (typeof window === 'undefined') return null
  const normalizedToken = String(token ?? '').trim()
  const normalizedTokenType = String(tokenType ?? 'Bearer').trim() || 'Bearer'
  let normalizedExpiresAt = null
  if (expiresAt) {
    const expiresAtDate = new Date(expiresAt)
    if (!Number.isNaN(expiresAtDate.getTime())) {
      normalizedExpiresAt = expiresAtDate.toISOString()
    }
  }
  const normalizedUserId = userId ? String(userId) : null
  const normalizedUsername = String(username ?? '').trim()
  const normalizedRole = role ? String(role) : null

  if (!normalizedUsername || !normalizedToken) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }

  const next = {
    token: normalizedToken,
    tokenType: normalizedTokenType,
    expiresAt: normalizedExpiresAt,
    userId: normalizedUserId,
    username: normalizedUsername,
    role: normalizedRole,
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
  return next
}

const clearAuthSession = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

const request = async (path, options = {}) => {
  const { skipAuth = false, ...fetchOptions } = options
  const authHeader = skipAuth ? null : authHeaderFromSession()

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(fetchOptions.headers ?? {}),
    },
    ...fetchOptions,
  })

  if (response.status === 204) return null

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Request failed with ${response.status}`))
  }

  return extractEnvelopeData(payload)
}

const toDateMs = (value) => {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? Date.now() : timestamp
}

const toIsoInstant = (value, fallback = new Date().toISOString()) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

const mapOpeningHours = (entries) => {
  const defaults = WEEK_DAYS.map((day) => ({
    day,
    open: '09:00',
    close: '22:00',
    isClosed: false,
  }))

  if (!Array.isArray(entries)) return defaults

  const byDay = new Map(entries.map((entry) => [Number(entry.dayOfWeek), entry]))

  return WEEK_DAYS.map((day, index) => {
    const apiEntry = byDay.get(index + 1)
    if (!apiEntry) return defaults[index]

    return {
      day,
      open: String(apiEntry.openTime ?? '09:00').slice(0, 5),
      close: String(apiEntry.closeTime ?? '22:00').slice(0, 5),
      isClosed: Boolean(apiEntry.closed),
    }
  })
}

const normalizeLegacyObjectType = (type, width, height, metadata) => {
  const raw = String(type ?? '')
  const upper = raw.toUpperCase()

  if (upper === 'TABLE') {
    const seats = Math.max(0, Number(metadata?.seats ?? 0) || 0)
    if (seats >= 8 || Number(width ?? 0) >= 120 || Number(height ?? 0) >= 120) {
      return 'large_table'
    }

    if (Math.abs(Number(width ?? 0) - Number(height ?? 0)) <= 10) {
      return 'round_table'
    }

    return 'square_table'
  }

  if (upper === 'CHAIR' || upper === 'DECOR') {
    return 'custom_rectangle'
  }

  return raw.toLowerCase()
}

const sortByName = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''))

const buildGoodsCatalog = (folders, items) => {
  const folderMap = new Map()

  for (const folder of Array.isArray(folders) ? folders : []) {
    folderMap.set(folder.id, {
      id: folder.id,
      name: folder.name,
      parentFolderId: folder.parentFolderId ?? null,
      sortOrder: Number(folder.sortOrder ?? 0),
      folders: [],
      items: [],
    })
  }

  for (const item of Array.isArray(items) ? items : []) {
    const parent = folderMap.get(item.folderId)
    if (!parent) continue
    parent.items.push({
      id: item.id,
      name: item.name,
      price: Number(item.price ?? 0),
      sortOrder: Number(item.sortOrder ?? 0),
    })
  }

  const roots = []

  for (const folder of folderMap.values()) {
    if (!folder.parentFolderId) {
      roots.push(folder)
      continue
    }

    const parent = folderMap.get(folder.parentFolderId)
    if (!parent) {
      roots.push(folder)
      continue
    }

    parent.folders.push(folder)
  }

  const sortTree = (nodes) => {
    nodes.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return sortByName(a, b)
    })

    for (const node of nodes) {
      node.items.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return sortByName(a, b)
      })
      sortTree(node.folders)
      delete node.parentFolderId
      delete node.sortOrder
      for (const item of node.items) {
        delete item.sortOrder
      }
    }
  }

  sortTree(roots)
  return roots
}

const mapFloorObject = (object) => {
  const metadata = parseJsonSafely(object.metadata, {})
  const width = Number(object.width ?? 80)
  const height = Number(object.height ?? 80)
  const normalizedType = normalizeLegacyObjectType(object.type, width, height, metadata)

  const fallbackTableNo = Number(metadata?.no)
  const fallbackLabel =
    normalizedType === 'square_table' || normalizedType === 'round_table' || normalizedType === 'large_table'
      ? `T-${String(Number.isFinite(fallbackTableNo) ? fallbackTableNo : 1).padStart(2, '0')}`
      : normalizedType

  const normalizedMetadata = {
    ...metadata,
    label: String(metadata?.label ?? '').trim() || fallbackLabel,
  }

  return {
    id: object.id,
    type: normalizedType,
    x: Number(object.x ?? 0),
    y: Number(object.y ?? 0),
    width,
    height,
    rotation: Number(object.rotation ?? 0),
    scaleX: Number(object.scaleX ?? 1),
    scaleY: Number(object.scaleY ?? 1),
    metadata: normalizedMetadata,
    createdAt: toDateMs(object.createdAt),
    updatedAt: toDateMs(object.updatedAt),
  }
}

const mapFloor = (floor, objects) => ({
  id: floor.id,
  name: floor.name,
  objects: (objects ?? []).map(mapFloorObject),
  size:
    floor.width && floor.height
      ? {
          width: Number(floor.width),
          height: Number(floor.height),
        }
      : null,
  createdAt: toDateMs(floor.createdAt),
  updatedAt: toDateMs(floor.updatedAt),
  canvasZoom: Number(floor.canvasZoom ?? 1),
  canvasPosition: {
    x: Number(floor.canvasPosX ?? 160),
    y: Number(floor.canvasPosY ?? 90),
  },
})

const mapRestaurant = (restaurant, floors, workers, openingHours, menuFolders, menuItems) => ({
  id: restaurant.id,
  name: restaurant.name,
  floors,
  goodsCatalog: buildGoodsCatalog(menuFolders, menuItems),
  workers: (workers ?? []).map((worker) => ({
    id: worker.id,
    userId: worker.userId,
    name: worker.name,
    role: workerRoleToFrontend(worker.role),
  })),
  openingHours: mapOpeningHours(openingHours),
  createdAt: toDateMs(restaurant.createdAt),
  updatedAt: toDateMs(restaurant.updatedAt),
})

const floorToPayload = (floor, restaurantId) => ({
  restaurantId,
  name: floor.name,
  width: floor.size?.width ?? null,
  height: floor.size?.height ?? null,
  canvasZoom: Number(floor.canvasZoom ?? 1).toFixed(2),
  canvasPosX: Math.round(Number(floor.canvasPosition?.x ?? 160)),
  canvasPosY: Math.round(Number(floor.canvasPosition?.y ?? 90)),
})

const floorObjectToPayload = (object, floorId) => ({
  floorId,
  type: object.type,
  x: Math.round(Number(object.x ?? 0)),
  y: Math.round(Number(object.y ?? 0)),
  width: Math.max(1, Math.round(Number(object.width ?? 1))),
  height: Math.max(1, Math.round(Number(object.height ?? 1))),
  rotation: Number(object.rotation ?? 0).toFixed(2),
  scaleX: Number(object.scaleX ?? 1).toFixed(3),
  scaleY: Number(object.scaleY ?? 1).toFixed(3),
  metadata: JSON.stringify(object.metadata ?? {}),
})

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? ''))

const login = (credentials) =>
  request('/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      username: credentials.username,
      password: credentials.password,
    }),
  })

const register = (payload) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: payload.username,
      password: payload.password,
      role: payload.role,
    }),
  })

const listUsers = (query = '') => {
  const normalized = String(query ?? '').trim()
  const params = normalized ? `?query=${encodeURIComponent(normalized)}` : ''
  return request(`/auth/users${params}`)
}

const listRestaurants = () => request('/restaurants')
const createRestaurant = (name) => request('/restaurants', { method: 'POST', body: JSON.stringify({ name }) })
const updateRestaurant = (restaurantId, name) =>
  request(`/restaurants/${restaurantId}`, { method: 'PATCH', body: JSON.stringify({ name }) })
const deleteRestaurant = (restaurantId) => request(`/restaurants/${restaurantId}`, { method: 'DELETE' })

const listFloors = (restaurantId) => request(`/restaurants/${restaurantId}/floors`)
const createFloor = (restaurantId, floor) =>
  request(`/restaurants/${restaurantId}/floors`, {
    method: 'POST',
    body: JSON.stringify(floorToPayload(floor, restaurantId)),
  })
const updateFloor = (restaurantId, floorId, floor) =>
  request(`/restaurants/${restaurantId}/floors/${floorId}`, {
    method: 'PATCH',
    body: JSON.stringify(floorToPayload(floor, restaurantId)),
  })
const deleteFloor = (restaurantId, floorId) =>
  request(`/restaurants/${restaurantId}/floors/${floorId}`, { method: 'DELETE' })

const listFloorObjects = (restaurantId, floorId) =>
  request(`/restaurants/${restaurantId}/floors/${floorId}/objects`)
const createFloorObject = (restaurantId, floorId, object) =>
  request(`/restaurants/${restaurantId}/floors/${floorId}/objects`, {
    method: 'POST',
    body: JSON.stringify(floorObjectToPayload(object, floorId)),
  })
const updateFloorObject = (restaurantId, floorId, objectId, object) =>
  request(`/restaurants/${restaurantId}/floors/${floorId}/objects/${objectId}`, {
    method: 'PATCH',
    body: JSON.stringify(floorObjectToPayload(object, floorId)),
  })
const deleteFloorObject = (restaurantId, floorId, objectId) =>
  request(`/restaurants/${restaurantId}/floors/${floorId}/objects/${objectId}`, { method: 'DELETE' })

const listWorkers = (restaurantId) => request(`/restaurants/${restaurantId}/workers`)
const createWorker = (restaurantId, worker) =>
  request(`/restaurants/${restaurantId}/workers`, {
    method: 'POST',
    body: JSON.stringify({
      userId: worker.userId,
      name: worker.name,
      role: workerRoleToBackend(worker.role),
    }),
  })
const updateWorker = (restaurantId, workerId, worker) =>
  request(`/restaurants/${restaurantId}/workers/${workerId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: worker.name,
      role: worker.role ? workerRoleToBackend(worker.role) : undefined,
    }),
  })
const deleteWorker = (restaurantId, workerId) =>
  request(`/restaurants/${restaurantId}/workers/${workerId}`, { method: 'DELETE' })

const listOpeningHours = (restaurantId) => request(`/restaurants/${restaurantId}/opening-hours`)
const getOpeningHours = async (restaurantId) => {
  const entries = await listOpeningHours(restaurantId)
  return mapOpeningHours(entries)
}
const upsertWeeklyOpeningHours = (restaurantId, openingHours) => {
  const payload = WEEK_DAYS.map((day, index) => {
    const item = openingHours.find((entry) => entry.day === day) ?? {}
    return {
      restaurantId,
      dayOfWeek: index + 1,
      openTime: String(item.open ?? '09:00'),
      closeTime: String(item.close ?? '22:00'),
      closed: Boolean(item.isClosed),
    }
  })

  return request(`/restaurants/${restaurantId}/opening-hours`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

const listMenuFoldersTree = (restaurantId) => request(`/restaurants/${restaurantId}/menu-folders/tree`)
const listAllMenuItems = (restaurantId) => request(`/restaurants/${restaurantId}/menu-items/all`)
const createMenuFolder = (restaurantId, payload) =>
  request(`/restaurants/${restaurantId}/menu-folders`, {
    method: 'POST',
    body: JSON.stringify({
      restaurantId,
      parentFolderId: payload.parentFolderId ?? null,
      name: payload.name,
      sortOrder: payload.sortOrder ?? 0,
    }),
  })
const updateMenuFolder = (restaurantId, folderId, payload) =>
  request(`/restaurants/${restaurantId}/menu-folders/${folderId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
const deleteMenuFolder = (restaurantId, folderId) =>
  request(`/restaurants/${restaurantId}/menu-folders/${folderId}`, { method: 'DELETE' })

const createMenuItem = (restaurantId, payload) =>
  request(`/restaurants/${restaurantId}/menu-items`, {
    method: 'POST',
    body: JSON.stringify({
      folderId: payload.folderId,
      name: payload.name,
      price: Number(payload.price ?? 0).toFixed(2),
      sortOrder: payload.sortOrder ?? 0,
    }),
  })
const updateMenuItem = (restaurantId, folderId, itemId, payload) =>
  request(`/restaurants/${restaurantId}/menu-folders/${folderId}/menu-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: payload.name,
      price: payload.price !== undefined ? Number(payload.price ?? 0).toFixed(2) : undefined,
      sortOrder: payload.sortOrder,
    }),
  })
const deleteMenuItem = (restaurantId, folderId, itemId) =>
  request(`/restaurants/${restaurantId}/menu-folders/${folderId}/menu-items/${itemId}`, {
    method: 'DELETE',
  })

const listTableReservations = async (restaurantId, tableObjectId) => {
  const reservations = await request(`/restaurants/${restaurantId}/tables/${tableObjectId}/reservations`)
  return (Array.isArray(reservations) ? reservations : []).map(mapReservationForUi)
}
const createReservation = (restaurantId, payload) =>
  request(`/restaurants/${restaurantId}/reservations`, {
    method: 'POST',
    body: JSON.stringify({
      tableObjectId: payload.tableObjectId,
      guestName: payload.guestName,
      partySize: Math.max(1, Math.round(Number(payload.partySize ?? 1))),
      startAt: toIsoInstant(payload.startAt),
      endAt: toIsoInstant(payload.endAt),
      note: payload.note ?? '',
    }),
  })
const updateReservation = (restaurantId, reservationId, payload) =>
  request(`/restaurants/${restaurantId}/reservations/${reservationId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      guestName: payload.guestName,
      partySize: payload.partySize,
      startAt: payload.startAt ? toIsoInstant(payload.startAt) : undefined,
      endAt: payload.endAt ? toIsoInstant(payload.endAt) : undefined,
      note: payload.note,
    }),
  })
const deleteReservation = (restaurantId, reservationId) =>
  request(`/restaurants/${restaurantId}/reservations/${reservationId}`, { method: 'DELETE' })

const listOpenOrders = (restaurantId, tableObjectId) =>
  request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders/open`)
const createTableOrder = (restaurantId, tableObjectId, workerId) =>
  request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders`, {
    method: 'POST',
    body: JSON.stringify({
      tableObjectId,
      workerId: workerId ?? null,
      status: 'OPEN',
    }),
  })
const deleteTableOrder = (restaurantId, tableObjectId, orderId) =>
  request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders/${orderId}`, {
    method: 'DELETE',
  })
const listOrderLines = (restaurantId, tableObjectId, orderId) =>
  request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders/${orderId}/lines`)
const addOrderLine = (restaurantId, tableObjectId, orderId, line) =>
  request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders/${orderId}/lines`, {
    method: 'POST',
    body: JSON.stringify({
      tableOrderId: orderId,
      itemName: line.name,
      quantity: Math.max(1, Math.round(Number(line.quantity ?? 1))),
      unitPrice: Number(line.unitPrice ?? 0).toFixed(2),
      note: line.note ?? '',
      placedByWorkerId: line.placedByWorkerId ?? null,
      placedByWorkerNameSnapshot: line.placedByWorkerName ?? null,
      status: orderLineStatusToBackend(line.status),
    }),
  })
const updateOrderLine = (restaurantId, tableObjectId, orderId, lineId, line) =>
  request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders/${orderId}/lines/${lineId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      itemName: line.name,
      quantity: line.quantity,
      unitPrice:
        line.unitPrice !== undefined ? Number(line.unitPrice ?? 0).toFixed(2) : undefined,
      note: line.note,
      placedByWorkerId: line.placedByWorkerId,
      placedByWorkerNameSnapshot: line.placedByWorkerName,
      status: line.status ? orderLineStatusToBackend(line.status) : undefined,
    }),
  })
const deleteOrderLine = (restaurantId, tableObjectId, orderId, lineId) =>
  request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders/${orderId}/lines/${lineId}`, {
    method: 'DELETE',
  })

const mapReservationForUi = (reservation) => ({
  id: reservation.id,
  guestName: reservation.guestName,
  partySize: Number(reservation.partySize ?? 1),
  startAt: toIsoInstant(reservation.startAt),
  endAt: toIsoInstant(reservation.endAt),
  note: reservation.note ?? '',
})

const mapOrderLineForUi = (line) => ({
  id: line.id,
  tableOrderId: line.tableOrderId,
  tableObjectId: line.tableObjectId ?? null,
  name: line.itemName,
  quantity: Number(line.quantity ?? 1),
  unitPrice: Number(line.unitPrice ?? 0),
  note: line.note ?? '',
  status: orderLineStatusToFrontend(line.status),
  placedByWorkerId: line.placedByWorkerId ?? null,
  placedByWorkerName: line.placedByWorkerNameSnapshot ?? null,
  statusUpdatedAt: toDateMs(line.statusUpdatedAt),
  inProgressAt: toDateMs(line.inProgressAt),
  inPrepAt: toDateMs(line.inPrepAt),
  readyForServerAt: toDateMs(line.readyForServerAt),
  servedAt: toDateMs(line.servedAt),
  createdAt: toDateMs(line.createdAt),
})

const mapKitchenOrderLineForUi = (line) => ({
  id: line.id,
  tableOrderId: line.tableOrderId,
  tableObjectId: line.tableObjectId,
  floorId: line.floorId,
  floorName: line.floorName,
  name: line.itemName,
  quantity: Number(line.quantity ?? 1),
  unitPrice: Number(line.unitPrice ?? 0),
  note: line.note ?? '',
  status: orderLineStatusToFrontend(line.status),
  placedByWorkerId: line.placedByWorkerId ?? null,
  placedByWorkerName: line.placedByWorkerNameSnapshot ?? null,
  statusUpdatedAt: toDateMs(line.statusUpdatedAt),
  inProgressAt: toDateMs(line.inProgressAt),
  inPrepAt: toDateMs(line.inPrepAt),
  readyForServerAt: toDateMs(line.readyForServerAt),
  servedAt: toDateMs(line.servedAt),
  createdAt: toDateMs(line.createdAt),
})

const listKitchenOrderLines = async (restaurantId, options = {}) => {
  const includeServed = options.includeServed === true
  const path = includeServed
    ? `/restaurants/${restaurantId}/kitchen/order-lines?includeServed=true`
    : `/restaurants/${restaurantId}/kitchen/order-lines`
  const lines = await request(path)
  return (Array.isArray(lines) ? lines : []).map(mapKitchenOrderLineForUi)
}

const fetchRestaurantsGraph = async () => {
  const restaurants = await listRestaurants()

  const graphs = await Promise.all(
    restaurants.map(async (restaurant) => {
      const [floors, workers, openingHours, menuFolders, menuItems] = await Promise.all([
        listFloors(restaurant.id),
        listWorkers(restaurant.id),
        listOpeningHours(restaurant.id),
        listMenuFoldersTree(restaurant.id),
        listAllMenuItems(restaurant.id),
      ])

      const floorObjects = await Promise.all(
        floors.map(async (floor) => ({
          floorId: floor.id,
          objects: await listFloorObjects(restaurant.id, floor.id),
        })),
      )

      const objectsByFloorId = new Map(floorObjects.map((entry) => [entry.floorId, entry.objects]))
      const mappedFloors = floors.map((floor) => mapFloor(floor, objectsByFloorId.get(floor.id) ?? []))

      return mapRestaurant(
        restaurant,
        mappedFloors,
        workers,
        openingHours,
        menuFolders,
        menuItems,
      )
    }),
  )

  return graphs
}

const saveFloorLayout = async (restaurantId, floor) => {
  await updateFloor(restaurantId, floor.id, floor)

  const existingObjects = await listFloorObjects(restaurantId, floor.id)
  const existingById = new Map(existingObjects.map((entry) => [entry.id, entry]))

  const createdIdMap = new Map()

  for (const object of floor.objects ?? []) {
    if (isUuid(object.id) && existingById.has(object.id)) {
      await updateFloorObject(restaurantId, floor.id, object.id, object)
      existingById.delete(object.id)
      continue
    }

    const created = await createFloorObject(restaurantId, floor.id, object)
    createdIdMap.set(object.id, created.id)
  }

  for (const staleId of existingById.keys()) {
    await deleteFloorObject(restaurantId, floor.id, staleId)
  }

  return createdIdMap
}

const fetchTableServiceState = async (restaurantId, tableObjectId) => {
  const [reservations, openOrders] = await Promise.all([
    listTableReservations(restaurantId, tableObjectId),
    listOpenOrders(restaurantId, tableObjectId),
  ])

  const lineEntries = await Promise.all(
    openOrders.map(async (order) => ({
      orderId: order.id,
      lines: await listOrderLines(restaurantId, tableObjectId, order.id),
    })),
  )

  const flattenedOrders = lineEntries.flatMap((entry) =>
    entry.lines.map((line) => mapOrderLineForUi({ ...line, tableOrderId: entry.orderId })),
  )

  return {
    reservations,
    orders: flattenedOrders,
    openOrderIds: openOrders.map((order) => order.id),
  }
}

const ensureOpenOrderId = async (restaurantId, tableObjectId, workerId) => {
  const openOrders = await listOpenOrders(restaurantId, tableObjectId)
  if (openOrders.length > 0) return openOrders[0].id
  const created = await createTableOrder(restaurantId, tableObjectId, workerId)
  return created.id
}

export const backendApi = {
  login,
  register,
  listUsers,
  setAuthSession,
  clearAuthSession,
  getAuthSession: parseStoredSession,
  fetchRestaurantsGraph,
  saveFloorLayout,
  fetchTableServiceState,
  ensureOpenOrderId,
  listRestaurants,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  listFloors,
  createFloor,
  updateFloor,
  deleteFloor,
  createWorker,
  updateWorker,
  deleteWorker,
  getOpeningHours,
  upsertWeeklyOpeningHours,
  createMenuFolder,
  updateMenuFolder,
  deleteMenuFolder,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  createReservation,
  listTableReservations,
  updateReservation,
  deleteReservation,
  addOrderLine,
  updateOrderLine,
  deleteOrderLine,
  deleteTableOrder,
  listKitchenOrderLines,
}
