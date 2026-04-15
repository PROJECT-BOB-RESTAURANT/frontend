import { snapToGrid, clamp } from '../../utils/grid'
import { getDefaultSeatsForType, isTableObjectType } from '../../utils/objectLibrary'
import { normalizeFrontendOrderLineStatus } from '../../utils/orderLineStatus'
import {
  DEFAULT_RESERVATION_HOURS,
  normalizeReservations,
  toDateMs,
} from '../../utils/reservations'
import {
  MAX_SCALE,
  MIN_SCALE,
  MIN_SIZE,
  WEEK_DAYS,
  createId,
} from './constants'

export { DEFAULT_RESERVATION_HOURS, normalizeReservations, toDateMs }

export const createDefaultOpeningHours = () =>
  WEEK_DAYS.map((day) => ({
    day,
    open: '09:00',
    close: '22:00',
    isClosed: false,
  }))

export const normalizeTime = (value, fallback) => {
  const text = String(value ?? '').trim()
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(text) ? text : fallback
}

export const normalizeOpeningHours = (hours) => {
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

export const normalizeOpeningDateOverrides = (overrides) => {
  if (!Array.isArray(overrides)) return []

  return overrides
    .map((entry) => {
      const date = String(entry?.date ?? '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

      return {
        date,
        open: normalizeTime(entry?.open, '09:00'),
        close: normalizeTime(entry?.close, '22:00'),
        isClosed: Boolean(entry?.isClosed),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const normalizeSeats = (value, fallback = 1) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.round(numeric))
}

export const normalizeOrders = (orders) => {
  if (!Array.isArray(orders)) return []

  return orders
    .map((order) => {
      const name = String(order?.name ?? '').trim()
      if (!name) return null

      const quantity = Math.max(1, Math.round(Number(order?.quantity ?? 1) || 1))

      return {
        id: order?.id ?? createId('order'),
        tableOrderId: order?.tableOrderId ?? null,
        tableObjectId: order?.tableObjectId ?? null,
        name,
        quantity,
        unitPrice: Math.max(0, Number(order?.unitPrice ?? 0) || 0),
        note: String(order?.note ?? '').trim(),
        status: normalizeFrontendOrderLineStatus(order?.status),
        placedByWorkerId: order?.placedByWorkerId ?? null,
        placedByWorkerName: order?.placedByWorkerName ?? null,
        statusUpdatedAt: order?.statusUpdatedAt ?? null,
        inProgressAt: order?.inProgressAt ?? null,
        inPrepAt: order?.inPrepAt ?? null,
        readyForServerAt: order?.readyForServerAt ?? null,
        servedAt: order?.servedAt ?? null,
        createdAt: order?.createdAt ?? Date.now(),
      }
    })
    .filter(Boolean)
}

const normalizeManualOccupiedUntil = (value) => {
  const ms = toDateMs(value)
  return ms ? new Date(ms).toISOString() : null
}

export const normalizePrice = (value) => {
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

export const normalizeMenuFolders = (folders) => {
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

export const createDefaultMenuFolders = () => [
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

export const normalizeWorkers = (workers) => {
  if (!Array.isArray(workers)) return []

  return workers
    .map((worker) => {
      const name = String(worker?.name ?? '').trim()
      if (!name) return null

      return {
        id: worker?.id ?? createId('worker'),
        name,
        role: String(worker?.role ?? 'staff').trim() || 'staff',
      }
    })
    .filter(Boolean)
}

export const updateFolderRecursive = (folders, folderId, updater) => {
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

export const removeFolderRecursive = (folders, folderId) => {
  return folders
    .filter((folder) => folder.id !== folderId)
    .map((folder) => ({
      ...folder,
      folders: removeFolderRecursive(folder.folders, folderId),
    }))
}

export const findFolderById = (folders, folderId) => {
  for (const folder of folders) {
    if (folder.id === folderId) return folder
    const nested = findFolderById(folder.folders, folderId)
    if (nested) return nested
  }

  return null
}

export const normalizeObject = (obj) => {
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
