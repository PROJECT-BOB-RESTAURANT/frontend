import {
  DEFAULT_CANVAS_POSITION,
  DEFAULT_CANVAS_ZOOM,
  createId,
} from './constants'
import {
  createDefaultMenuFolders,
  createDefaultOpeningHours,
} from './normalizers'

export const cloneObjects = (objects) =>
  objects.map((obj) => ({ ...obj, metadata: { ...obj.metadata } }))

export const createFloorModel = (name, size) => ({
  id: createId('floor'),
  name,
  objects: [],
  size: size ?? null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  canvasZoom: DEFAULT_CANVAS_ZOOM,
  canvasPosition: { ...DEFAULT_CANVAS_POSITION },
})

export const cloneFloor = (floor) => ({
  ...floor,
  objects: cloneObjects(floor.objects ?? []),
  canvasPosition: { ...(floor.canvasPosition ?? DEFAULT_CANVAS_POSITION) },
})

export const createRestaurantModel = (name) => ({
  id: createId('restaurant'),
  name,
  floors: [],
  goodsCatalog: createDefaultMenuFolders(),
  workers: [],
  openingHours: createDefaultOpeningHours(),
  openingDateOverrides: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

export const persistRestaurantFloors = (restaurants, restaurantId, floors) => {
  return restaurants.map((restaurant) => {
    if (restaurant.id !== restaurantId) return restaurant

    return {
      ...restaurant,
      floors: floors.map(cloneFloor),
      updatedAt: Date.now(),
    }
  })
}

export const updateCurrentRestaurant = (state, updater) => {
  return state.restaurants.map((restaurant) => {
    if (restaurant.id !== state.currentRestaurantId) return restaurant

    const nextRestaurant = updater(restaurant)
    return {
      ...nextRestaurant,
      updatedAt: Date.now(),
    }
  })
}

export const persistCurrentFloor = (state) => {
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

export const loadFloorIntoEditor = (state, floorId) => {
  const floor = state.floors.find((item) => item.id === floorId)
  if (!floor) return state

  return {
    ...state,
    currentFloorId: floor.id,
    objects: cloneObjects(floor.objects),
    canvasZoom: floor.canvasZoom ?? DEFAULT_CANVAS_ZOOM,
    canvasPosition: floor.canvasPosition ?? DEFAULT_CANVAS_POSITION,
    selectedObjectId: null,
  }
}

export const persistCurrentRestaurant = (state) => {
  if (!state.currentRestaurantId) return state.restaurants

  const persistedFloors = persistCurrentFloor(state)
  return persistRestaurantFloors(state.restaurants, state.currentRestaurantId, persistedFloors)
}

export const loadRestaurantIntoWorkspace = (state, restaurantId) => {
  const restaurant = state.restaurants.find((item) => item.id === restaurantId)
  if (!restaurant) return state

  const floors = Array.isArray(restaurant.floors) ? restaurant.floors.map(cloneFloor) : []
  const firstFloor = floors[0] ?? null

  return {
    ...state,
    currentRestaurantId: restaurant.id,
    floors,
    currentFloorId: firstFloor?.id ?? null,
    objects: cloneObjects(firstFloor?.objects ?? []),
    canvasZoom: firstFloor?.canvasZoom ?? DEFAULT_CANVAS_ZOOM,
    canvasPosition: firstFloor?.canvasPosition ?? DEFAULT_CANVAS_POSITION,
    selectedObjectId: null,
  }
}
