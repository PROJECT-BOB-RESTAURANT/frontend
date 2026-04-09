import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { backendApi } from '../services/backendApi'
import { useFloorStore } from '../store/useFloorStore'
import { snapToGrid, toWorldPoint } from '../utils/grid'
import { getObjectPreset } from '../utils/objectLibrary'

function useAppController(role) {
  const addObjectFromPreset = useFloorStore((state) => state.addObjectFromPreset)
  const moveObjectByDelta = useFloorStore((state) => state.moveObjectByDelta)
  const canvasZoom = useFloorStore((state) => state.canvasZoom)
  const canvasPosition = useFloorStore((state) => state.canvasPosition)
  const snapEnabled = useFloorStore((state) => state.snapEnabled)
  const page = useFloorStore((state) => state.page)
  const editorMode = useFloorStore((state) => state.editorMode)
  const hydrateFromBackend = useFloorStore((state) => state.hydrateFromBackend)
  const applyCreatedObjectIds = useFloorStore((state) => state.applyCreatedObjectIds)
  const restaurants = useFloorStore((state) => state.restaurants)
  const currentRestaurantId = useFloorStore((state) => state.currentRestaurantId)
  const floors = useFloorStore((state) => state.floors)
  const currentFloorId = useFloorStore((state) => state.currentFloorId)
  const objects = useFloorStore((state) => state.objects)
  const openRestaurant = useFloorStore((state) => state.openRestaurant)
  const openKitchenForRestaurant = useFloorStore((state) => state.openKitchenForRestaurant)
  const openReservationStatisticsForRestaurant = useFloorStore((state) => state.openReservationStatisticsForRestaurant)
  const openGuestReservationPage = useFloorStore((state) => state.openGuestReservationPage)
  const switchRestaurantInManagement = useFloorStore((state) => state.switchRestaurantInManagement)
  const switchRestaurantInReservationStatistics = useFloorStore((state) => state.switchRestaurantInReservationStatistics)
  const switchRestaurantInEditor = useFloorStore((state) => state.switchRestaurantInEditor)
  const backToRestaurants = useFloorStore((state) => state.backToRestaurants)
  const openFloor = useFloorStore((state) => state.openFloor)
  const backToManagement = useFloorStore((state) => state.backToManagement)
  const switchFloorInEditor = useFloorStore((state) => state.switchFloorInEditor)
  const setEditorMode = useFloorStore((state) => state.setEditorMode)
  const waiterTableId = useFloorStore((state) => state.waiterTableId)
  const waiterWorkerId = useFloorStore((state) => state.waiterWorkerId)
  const selectedObjectId = useFloorStore((state) => state.selectedObjectId)

  const [isBackendLoading, setIsBackendLoading] = useState(false)
  const [backendFeedback, setBackendFeedback] = useState('')
  const initialPage = useRef(page)
  const initialEditorMode = useRef(editorMode)

  const currentFloor = useMemo(
    () => floors.find((floor) => floor.id === currentFloorId) ?? null,
    [floors, currentFloorId],
  )

  const currentRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === currentRestaurantId) ?? null,
    [restaurants, currentRestaurantId],
  )

  const reloadFromBackend = useCallback(
    async (message = '') => {
      const graph = await backendApi.fetchRestaurantsGraph()
      hydrateFromBackend(graph, {
        currentRestaurantId,
        currentFloorId,
        page,
        editorMode,
        waiterTableId,
        waiterWorkerId,
        selectedObjectId,
      })
      if (message) {
        setBackendFeedback(message)
      }
    },
    [
      hydrateFromBackend,
      currentRestaurantId,
      currentFloorId,
      page,
      editorMode,
      waiterTableId,
      waiterWorkerId,
      selectedObjectId,
    ],
  )

  useEffect(() => {
    let active = true

    const load = async () => {
      setIsBackendLoading(true)
      try {
        const graph = await backendApi.fetchRestaurantsGraph()
        if (!active) return
        hydrateFromBackend(graph, {
          page: initialPage.current,
          editorMode: initialEditorMode.current,
        })
        setBackendFeedback('Loaded data from backend.')
      } catch (error) {
        if (!active) return
        setBackendFeedback(error.message)
      } finally {
        if (active) {
          setIsBackendLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [hydrateFromBackend])

  const withLoading = useCallback(async (operation) => {
    setIsBackendLoading(true)
    try {
      await operation()
    } catch (error) {
      setBackendFeedback(error.message)
    } finally {
      setIsBackendLoading(false)
    }
  }, [])

  const createRestaurant = useCallback(async () => {
    const name = window.prompt('Restaurant name', `Restaurant ${restaurants.length + 1}`)
    if (!name) return

    await withLoading(async () => {
      const created = await backendApi.createRestaurant(name)
      await reloadFromBackend('Restaurant created.')
      const restaurantId = created?.id ?? created
      if (restaurantId) {
        openRestaurant(restaurantId)
      }
    })
  }, [restaurants.length, withLoading, reloadFromBackend, openRestaurant])

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
      await withLoading(async () => {
        await backendApi.deleteRestaurant(restaurantId)
        await reloadFromBackend('Restaurant deleted.')
      })
    },
    [withLoading, reloadFromBackend],
  )

  const createFloor = useCallback(async () => {
    const name = window.prompt('Floor name', `Floor ${floors.length + 1}`)
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
  }, [floors.length, withLoading, currentRestaurantId, reloadFromBackend])

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
  ])

  const onDragEnd = useCallback(
    (event) => {
      const { active, over, delta, activatorEvent } = event
      if (!over || over.id !== 'floor-canvas') return

      const data = active.data.current
      if (!data || !activatorEvent || !('clientX' in activatorEvent)) return

      const canPlaceInTableMode = role === 'ADMIN' || role === 'MANAGER'

      const overRect = over.rect?.current ?? over.rect
      if (!overRect || overRect.left === undefined || overRect.top === undefined) return

      if (data.source === 'library') {
        if (editorMode !== 'edit' && !canPlaceInTableMode) return

        const preset = getObjectPreset(data.presetId)
        if (!preset) return

        const world = toWorldPoint(
          activatorEvent.clientX + delta.x,
          activatorEvent.clientY + delta.y,
          {
            left: overRect.left,
            top: overRect.top,
          },
          canvasPosition,
          canvasZoom,
        )

        const centeredX = snapEnabled
          ? snapToGrid(world.x - preset.config.width / 2)
          : world.x - preset.config.width / 2
        const centeredY = snapEnabled
          ? snapToGrid(world.y - preset.config.height / 2)
          : world.y - preset.config.height / 2

        addObjectFromPreset(preset, centeredX, centeredY)
        return
      }

      if (data.source === 'canvas') {
        if (editorMode !== 'edit') return

        moveObjectByDelta(
          data.objectId,
          snapEnabled ? snapToGrid(delta.x / canvasZoom) : delta.x / canvasZoom,
          snapEnabled ? snapToGrid(delta.y / canvasZoom) : delta.y / canvasZoom,
        )
      }
    },
    [editorMode, role, canvasPosition, canvasZoom, snapEnabled, addObjectFromPreset, moveObjectByDelta],
  )

  return {
    page,
    editorMode,
    restaurants,
    floors,
    currentRestaurant,
    currentRestaurantId,
    currentFloorId,
    isBackendLoading,
    backendFeedback,
    openRestaurant,
    openKitchenForRestaurant,
    openReservationStatisticsForRestaurant,
    openGuestReservationPage,
    switchRestaurantInManagement,
    switchRestaurantInReservationStatistics,
    switchRestaurantInEditor,
    backToRestaurants,
    openFloor,
    backToManagement,
    switchFloorInEditor,
    setEditorMode,
    reloadFromBackend,
    createRestaurant,
    renameRestaurant,
    deleteRestaurant,
    createFloor,
    renameFloor,
    deleteFloor,
    onSaveCurrentFloorLayout,
    onDragEnd,
  }
}

export { useAppController }
