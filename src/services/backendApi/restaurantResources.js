import { request } from './core'
import {
  WEEK_DAYS,
  floorObjectToPayload,
  floorToPayload,
  mapFloor,
  mapOpeningHours,
  mapRestaurant,
  workerRoleToBackend,
} from './mappers'

export const listRestaurants = () => request('/restaurants')

export const createRestaurant = (name) =>
  request('/restaurants', { method: 'POST', body: JSON.stringify({ name }) })

export const updateRestaurant = (restaurantId, name) =>
  request(`/restaurants/${restaurantId}`, { method: 'PATCH', body: JSON.stringify({ name }) })

export const deleteRestaurant = (restaurantId) =>
  request(`/restaurants/${restaurantId}`, { method: 'DELETE' })

export const listFloors = (restaurantId) => request(`/restaurants/${restaurantId}/floors`)

export const createFloor = (restaurantId, floor) =>
  request(`/restaurants/${restaurantId}/floors`, {
    method: 'POST',
    body: JSON.stringify(floorToPayload(floor, restaurantId)),
  })

export const updateFloor = (restaurantId, floorId, floor) =>
  request(`/restaurants/${restaurantId}/floors/${floorId}`, {
    method: 'PATCH',
    body: JSON.stringify(floorToPayload(floor, restaurantId)),
  })

export const deleteFloor = (restaurantId, floorId) =>
  request(`/restaurants/${restaurantId}/floors/${floorId}`, { method: 'DELETE' })

export const listFloorObjects = (restaurantId, floorId) =>
  request(`/restaurants/${restaurantId}/floors/${floorId}/objects`)

export const createFloorObject = (restaurantId, floorId, object) =>
  request(`/restaurants/${restaurantId}/floors/${floorId}/objects`, {
    method: 'POST',
    body: JSON.stringify(floorObjectToPayload(object, floorId)),
  })

export const updateFloorObject = (restaurantId, floorId, objectId, object) =>
  request(`/restaurants/${restaurantId}/floors/${floorId}/objects/${objectId}`, {
    method: 'PATCH',
    body: JSON.stringify(floorObjectToPayload(object, floorId)),
  })

export const deleteFloorObject = (restaurantId, floorId, objectId) =>
  request(`/restaurants/${restaurantId}/floors/${floorId}/objects/${objectId}`, { method: 'DELETE' })

export const listWorkers = (restaurantId) => request(`/restaurants/${restaurantId}/workers`)

export const createWorker = (restaurantId, worker) =>
  request(`/restaurants/${restaurantId}/workers`, {
    method: 'POST',
    body: JSON.stringify({
      userId: worker.userId,
      name: worker.name,
      role: workerRoleToBackend(worker.role),
    }),
  })

export const updateWorker = (restaurantId, workerId, worker) =>
  request(`/restaurants/${restaurantId}/workers/${workerId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: worker.name,
      role: worker.role ? workerRoleToBackend(worker.role) : undefined,
    }),
  })

export const deleteWorker = (restaurantId, workerId) =>
  request(`/restaurants/${restaurantId}/workers/${workerId}`, { method: 'DELETE' })

export const listOpeningHours = (restaurantId) =>
  request(`/restaurants/${restaurantId}/opening-hours`)

export const getOpeningHours = async (restaurantId) => {
  const entries = await listOpeningHours(restaurantId)
  return mapOpeningHours(entries)
}

export const upsertWeeklyOpeningHours = (restaurantId, openingHours) => {
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

export const listMenuFoldersTree = (restaurantId) =>
  request(`/restaurants/${restaurantId}/menu-folders/tree`)

export const listAllMenuItems = (restaurantId) =>
  request(`/restaurants/${restaurantId}/menu-items/all`)

export const createMenuFolder = (restaurantId, payload) =>
  request(`/restaurants/${restaurantId}/menu-folders`, {
    method: 'POST',
    body: JSON.stringify({
      restaurantId,
      parentFolderId: payload.parentFolderId ?? null,
      name: payload.name,
      sortOrder: payload.sortOrder ?? 0,
    }),
  })

export const updateMenuFolder = (restaurantId, folderId, payload) =>
  request(`/restaurants/${restaurantId}/menu-folders/${folderId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const deleteMenuFolder = (restaurantId, folderId) =>
  request(`/restaurants/${restaurantId}/menu-folders/${folderId}`, { method: 'DELETE' })

export const createMenuItem = (restaurantId, payload) =>
  request(`/restaurants/${restaurantId}/menu-items`, {
    method: 'POST',
    body: JSON.stringify({
      folderId: payload.folderId,
      name: payload.name,
      price: Number(payload.price ?? 0).toFixed(2),
      sortOrder: payload.sortOrder ?? 0,
    }),
  })

export const updateMenuItem = (restaurantId, folderId, itemId, payload) =>
  request(`/restaurants/${restaurantId}/menu-folders/${folderId}/menu-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: payload.name,
      price: payload.price !== undefined ? Number(payload.price ?? 0).toFixed(2) : undefined,
      sortOrder: payload.sortOrder,
    }),
  })

export const deleteMenuItem = (restaurantId, folderId, itemId) =>
  request(`/restaurants/${restaurantId}/menu-folders/${folderId}/menu-items/${itemId}`, {
    method: 'DELETE',
  })

export const fetchRestaurantsGraph = async () => {
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
