import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { backendApi } from '../services/backendApi'
import { useFloorStore } from '../store/useFloorStore'
import { isTableObjectType } from '../utils/objectLibrary'
import { createOnDragEnd } from './useAppController/createOnDragEnd'
import { useCrudActions } from './useAppController/useCrudActions'

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
  const setTableReservationsData = useFloorStore((state) => state.setTableReservationsData)
  const exportFloorPlanJson = useFloorStore((state) => state.exportFloorPlanJson)
  const exportRestaurantJson = useFloorStore((state) => state.exportRestaurantJson)
  const storeLoadRestaurantJson = useFloorStore((state) => state.loadRestaurantJson)

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

  const currentFloorTableIds = useMemo(
    () =>
      (currentFloor?.objects ?? [])
        .filter((object) => isTableObjectType(object.type))
        .map((object) => object.id),
    [currentFloor],
  )

  const syncCurrentFloorReservations = useCallback(async () => {
    if (!currentRestaurantId || currentFloorTableIds.length === 0) return

    const entries = await Promise.all(
      currentFloorTableIds.map(async (tableId) => ({
        tableId,
        reservations: await backendApi.listTableReservations(currentRestaurantId, tableId),
      })),
    )

    for (const entry of entries) {
      setTableReservationsData(entry.tableId, entry.reservations)
    }
  }, [currentRestaurantId, currentFloorTableIds, setTableReservationsData])

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

  const importFloorPlanJson = useCallback(
    async (payload, restaurantId = currentRestaurantId) => {
      if (role !== 'ADMIN') {
        throw new Error('Only admins can import floor plan JSON.')
      }

      if (!restaurantId) {
        throw new Error('No restaurant selected.')
      }

      const parsed = JSON.parse(payload)
      let parsedFloors = parsed.floors

      if (Array.isArray(parsed.objects)) {
        parsedFloors = [
          {
            name: 'Imported Floor',
            objects: parsed.objects,
          },
        ]
      }

      if (!Array.isArray(parsedFloors)) {
        throw new Error('Layout JSON must include a floors array')
      }

      setIsBackendLoading(true)
      try {
        const backendFloors = await backendApi.listFloors(restaurantId)
        const backendFloorIds = new Set((backendFloors ?? []).map((floor) => floor.id))

        for (const [index, floor] of parsedFloors.entries()) {
          const preparedFloor = {
            id: floor.id,
            name: floor.name ?? `Floor ${index + 1}`,
            size: floor.size ?? null,
            canvasZoom: floor.canvasZoom ?? 1,
            canvasPosition: floor.canvasPosition ?? { x: 160, y: 90 },
            objects: Array.isArray(floor.objects) ? floor.objects : [],
          }

          let persistedFloorId = preparedFloor.id

          if (persistedFloorId && backendFloorIds.has(persistedFloorId)) {
            await backendApi.updateFloor(restaurantId, persistedFloorId, preparedFloor)
          } else {
            const createdFloor = await backendApi.createFloor(restaurantId, preparedFloor)
            persistedFloorId = createdFloor?.id ?? createdFloor
          }

          await backendApi.saveFloorLayout(restaurantId, {
            ...preparedFloor,
            id: persistedFloorId,
          })
        }

        await reloadFromBackend('Floor plan imported and saved.')
      } catch (error) {
        setBackendFeedback(error.message)
        throw error
      } finally {
        setIsBackendLoading(false)
      }
    },
    [currentRestaurantId, reloadFromBackend, setBackendFeedback, setIsBackendLoading],
  )

  const exportFloorPlanJsonForAdmin = useCallback(
    (restaurantId = currentRestaurantId) => {
      if (role !== 'ADMIN') {
        throw new Error('Only admins can export floor plan JSON.')
      }

      return exportFloorPlanJson(restaurantId)
    },
    [currentRestaurantId, exportFloorPlanJson, role],
  )

  const exportRestaurantJsonForAdmin = useCallback(
    (restaurantId = currentRestaurantId) => {
      if (role !== 'ADMIN') {
        throw new Error('Only admins can export restaurant JSON.')
      }

      return exportRestaurantJson(restaurantId)
    },
    [currentRestaurantId, exportRestaurantJson, role],
  )

  const loadRestaurantJsonForAdmin = useCallback(
    (payload, restaurantId = currentRestaurantId) => {
      if (role !== 'ADMIN') {
        throw new Error('Only admins can import restaurant JSON.')
      }

      return storeLoadRestaurantJson(payload, restaurantId)
    },
    [currentRestaurantId, role, storeLoadRestaurantJson],
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

  useEffect(() => {
    let active = true

    const sync = async () => {
      try {
        await syncCurrentFloorReservations()
      } catch (error) {
        if (!active) return
        setBackendFeedback(error.message)
      }
    }

    sync()

    return () => {
      active = false
    }
  }, [syncCurrentFloorReservations])

  const {
    createRestaurant,
    renameRestaurant,
    deleteRestaurant,
    createFloor,
    renameFloor,
    deleteFloor,
    onSaveCurrentFloorLayout,
  } = useCrudActions({
    restaurantsLength: restaurants.length,
    floorsLength: floors.length,
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
  })

  const onDragEnd = useMemo(
    () =>
      createOnDragEnd({
        editorMode,
        role,
        canvasPosition,
        canvasZoom,
        snapEnabled,
        addObjectFromPreset,
        moveObjectByDelta,
      }),
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
    exportFloorPlanJson: exportFloorPlanJsonForAdmin,
    loadFloorPlanJson: importFloorPlanJson,
    exportRestaurantJson: exportRestaurantJsonForAdmin,
    loadRestaurantJson: loadRestaurantJsonForAdmin,
    onDragEnd,
  }
}

export { useAppController }
