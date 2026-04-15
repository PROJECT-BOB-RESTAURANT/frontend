import { useCallback } from 'react'
import { backendApi } from '../../services/backendApi'

export function useCrudActions({
  restaurantsLength,
  floorsLength,
  currentRestaurantId,
  currentFloor,
  objects,
  canvasZoom,
  canvasPosition,
  openRestaurant,
  applyCreatedObjectIds,
  reloadFromBackend,
  setIsBackendLoading,
  setBackendFeedback,
}) {
  const withLoading = useCallback(
    async (operation) => {
      setIsBackendLoading(true)
      try {
        await operation()
      } catch (error) {
        setBackendFeedback(error.message)
      } finally {
        setIsBackendLoading(false)
      }
    },
    [setBackendFeedback, setIsBackendLoading],
  )

  const createRestaurant = useCallback(async () => {
    const name = window.prompt('Restaurant name', `Restaurant ${restaurantsLength + 1}`)
    if (!name) return

    await withLoading(async () => {
      const created = await backendApi.createRestaurant(name)
      await reloadFromBackend('Restaurant created.')
      const restaurantId = created?.id ?? created
      if (restaurantId) {
        openRestaurant(restaurantId)
      }
    })
  }, [restaurantsLength, withLoading, reloadFromBackend, openRestaurant])

  const renameRestaurant = useCallback(
    async (restaurant) => {
      const nextName = window.prompt('Rename restaurant', restaurant.name)
      if (!nextName) return

      await withLoading(async () => {
        await backendApi.updateRestaurant(restaurant.id, nextName)
        await reloadFromBackend('Restaurant renamed.')
      })
    },
    [withLoading, reloadFromBackend],
  )

  const deleteRestaurant = useCallback(
    async (restaurantId) => {
      const shouldDelete = window.confirm('Do you really want to delete this restaurant?')
      if (!shouldDelete) return

      await withLoading(async () => {
        await backendApi.deleteRestaurant(restaurantId)
        await reloadFromBackend('Restaurant deleted.')
      })
    },
    [withLoading, reloadFromBackend],
  )

  const createFloor = useCallback(async () => {
    const name = window.prompt('Floor name', `Floor ${floorsLength + 1}`)
    if (!name) return
    const width = window.prompt('Optional floor width (leave empty to skip)', '')
    const height = window.prompt('Optional floor height (leave empty to skip)', '')
    const size =
      width && height
        ? { width: Number(width) || null, height: Number(height) || null }
        : null

    await withLoading(async () => {
      await backendApi.createFloor(currentRestaurantId, {
        name,
        size,
        canvasZoom: 1,
        canvasPosition: { x: 160, y: 90 },
      })
      await reloadFromBackend('Floor created.')
    })
  }, [floorsLength, withLoading, currentRestaurantId, reloadFromBackend])

  const renameFloor = useCallback(
    async (floor) => {
      const nextName = window.prompt('Rename floor', floor.name)
      if (!nextName) return

      await withLoading(async () => {
        await backendApi.updateFloor(currentRestaurantId, floor.id, {
          ...floor,
          name: nextName,
        })
        await reloadFromBackend('Floor renamed.')
      })
    },
    [withLoading, currentRestaurantId, reloadFromBackend],
  )

  const deleteFloor = useCallback(
    async (floorId) => {
      await withLoading(async () => {
        await backendApi.deleteFloor(currentRestaurantId, floorId)
        await reloadFromBackend('Floor deleted.')
      })
    },
    [withLoading, currentRestaurantId, reloadFromBackend],
  )

  const onSaveCurrentFloorLayout = useCallback(async () => {
    if (!currentRestaurantId || !currentFloor) return

    const shouldSave = window.confirm('Do you want to save the floor layout?')
    if (!shouldSave) return

    const floorToSave = {
      ...currentFloor,
      objects,
      canvasZoom,
      canvasPosition,
    }

    setIsBackendLoading(true)
    try {
      const createdIdMap = await backendApi.saveFloorLayout(currentRestaurantId, floorToSave)
      applyCreatedObjectIds(createdIdMap)
      await reloadFromBackend('Floor layout saved to backend.')
    } catch (error) {
      setBackendFeedback(error.message)
    } finally {
      setIsBackendLoading(false)
    }
  }, [
    currentRestaurantId,
    currentFloor,
    objects,
    canvasZoom,
    canvasPosition,
    applyCreatedObjectIds,
    reloadFromBackend,
    setBackendFeedback,
    setIsBackendLoading,
  ])

  return {
    createRestaurant,
    renameRestaurant,
    deleteRestaurant,
    createFloor,
    renameFloor,
    deleteFloor,
    onSaveCurrentFloorLayout,
  }
}
