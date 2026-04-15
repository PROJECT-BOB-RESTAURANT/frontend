import { isUuid } from './core'
import {
  createFloorObject,
  deleteFloorObject,
  listFloorObjects,
  updateFloor,
  updateFloorObject,
} from './restaurantResources'

export const saveFloorLayout = async (restaurantId, floor) => {
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
