import { orderLineStatusToFrontend } from '../../utils/orderLineStatus'
import { parseJsonSafely, toDateMs, toIsoInstant } from './core'

export const WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export const workerRoleToFrontend = (role) => {
  const normalized = String(role ?? '').trim().toUpperCase()
  if (normalized === 'ADMIN' || normalized === 'MANAGER' || normalized === 'STAFF') {
    return normalized.toLowerCase()
  }
  return 'staff'
}

export const workerRoleToBackend = (role) => {
  const normalized = String(role ?? '').trim().toUpperCase()
  if (normalized === 'ADMIN' || normalized === 'MANAGER' || normalized === 'STAFF') return normalized
  return 'STAFF'
}

export const mapOpeningHours = (entries) => {
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

export const mapOpeningDateOverrides = (entries) => {
  if (!Array.isArray(entries)) return []

  return entries
    .map((entry) => {
      const date = String(entry.serviceDate ?? '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

      return {
        date,
        open: String(entry.openTime ?? '09:00').slice(0, 5),
        close: String(entry.closeTime ?? '22:00').slice(0, 5),
        isClosed: Boolean(entry.closed),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
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

export const mapFloorObject = (object) => {
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

export const mapFloor = (floor, objects) => ({
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

export const mapRestaurant = (
  restaurant,
  floors,
  workers,
  openingHours,
  openingDateOverrides,
  menuFolders,
  menuItems,
) => ({
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
  openingDateOverrides: mapOpeningDateOverrides(openingDateOverrides),
  createdAt: toDateMs(restaurant.createdAt),
  updatedAt: toDateMs(restaurant.updatedAt),
})

export const floorToPayload = (floor, restaurantId) => ({
  restaurantId,
  name: floor.name,
  width: floor.size?.width ?? null,
  height: floor.size?.height ?? null,
  canvasZoom: Number(floor.canvasZoom ?? 1).toFixed(2),
  canvasPosX: Math.round(Number(floor.canvasPosition?.x ?? 160)),
  canvasPosY: Math.round(Number(floor.canvasPosition?.y ?? 90)),
})

export const floorObjectToPayload = (object, floorId) => ({
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

export const mapReservationForUi = (reservation) => ({
  id: reservation.id,
  guestName: reservation.guestName,
  partySize: Number(reservation.partySize ?? 1),
  startAt: toIsoInstant(reservation.startAt),
  endAt: toIsoInstant(reservation.endAt),
  note: reservation.note ?? '',
})

export const mapOrderLineForUi = (line) => ({
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

export const mapKitchenOrderLineForUi = (line) => ({
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
