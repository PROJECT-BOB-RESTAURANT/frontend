import { orderLineStatusToBackend } from '../../utils/orderLineStatus'
import { ensurePersistedTableId, hasPersistedTableId, request, toIsoInstant } from './core'
import {
  mapKitchenOrderLineForUi,
  mapOrderLineForUi,
  mapReservationForUi,
} from './mappers'

export const listTableReservations = async (restaurantId, tableObjectId) => {
  if (!hasPersistedTableId(tableObjectId)) {
    return []
  }

  const reservations = await request(`/restaurants/${restaurantId}/tables/${tableObjectId}/reservations`)
  return (Array.isArray(reservations) ? reservations : []).map(mapReservationForUi)
}

export const createReservation = (restaurantId, payload) => {
  ensurePersistedTableId(payload?.tableObjectId)

  return request(`/restaurants/${restaurantId}/reservations`, {
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
}

export const updateReservation = (restaurantId, reservationId, payload) =>
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

export const deleteReservation = (restaurantId, reservationId) =>
  request(`/restaurants/${restaurantId}/reservations/${reservationId}`, { method: 'DELETE' })

export const listOpenOrders = (restaurantId, tableObjectId) => {
  if (!hasPersistedTableId(tableObjectId)) {
    return Promise.resolve([])
  }

  return request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders/open`)
}

export const createTableOrder = (restaurantId, tableObjectId, workerId) => {
  ensurePersistedTableId(tableObjectId)

  return request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders`, {
    method: 'POST',
    body: JSON.stringify({
      tableObjectId,
      workerId: workerId ?? null,
      status: 'OPEN',
    }),
  })
}

export const deleteTableOrder = (restaurantId, tableObjectId, orderId) => {
  ensurePersistedTableId(tableObjectId)

  return request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders/${orderId}`, {
    method: 'DELETE',
  })
}

export const listOrderLines = (restaurantId, tableObjectId, orderId) => {
  if (!hasPersistedTableId(tableObjectId)) {
    return Promise.resolve([])
  }

  return request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders/${orderId}/lines`)
}

export const addOrderLine = (restaurantId, tableObjectId, orderId, line) => {
  ensurePersistedTableId(tableObjectId)

  return request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders/${orderId}/lines`, {
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
}

export const updateOrderLine = (restaurantId, tableObjectId, orderId, lineId, line) => {
  ensurePersistedTableId(tableObjectId)

  return request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders/${orderId}/lines/${lineId}`, {
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
}

export const deleteOrderLine = (restaurantId, tableObjectId, orderId, lineId) => {
  ensurePersistedTableId(tableObjectId)

  return request(`/restaurants/${restaurantId}/tables/${tableObjectId}/orders/${orderId}/lines/${lineId}`, {
    method: 'DELETE',
  })
}

export const listKitchenOrderLines = async (restaurantId, options = {}) => {
  const includeServed = options.includeServed === true
  const path = includeServed
    ? `/restaurants/${restaurantId}/kitchen/order-lines?includeServed=true`
    : `/restaurants/${restaurantId}/kitchen/order-lines`
  const lines = await request(path)
  return (Array.isArray(lines) ? lines : []).map(mapKitchenOrderLineForUi)
}

export const fetchTableServiceState = async (restaurantId, tableObjectId) => {
  if (!hasPersistedTableId(tableObjectId)) {
    return {
      reservations: [],
      orders: [],
      openOrderIds: [],
    }
  }

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

export const ensureOpenOrderId = async (restaurantId, tableObjectId, workerId) => {
  ensurePersistedTableId(tableObjectId)

  const openOrders = await listOpenOrders(restaurantId, tableObjectId)
  if (openOrders.length > 0) return openOrders[0].id
  const created = await createTableOrder(restaurantId, tableObjectId, workerId)
  return created.id
}
