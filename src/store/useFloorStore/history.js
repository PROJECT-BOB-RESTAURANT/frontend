import { cloneObjects } from './workspaceHelpers'

export const EDITOR_HISTORY_LIMIT = 120

export const createEditorSnapshot = (state) => ({
  restaurantId: state.currentRestaurantId ?? null,
  floorId: state.currentFloorId ?? null,
  objects: cloneObjects(state.objects ?? []),
  selectedObjectId: state.selectedObjectId ?? null,
  canvasZoom: Number(state.canvasZoom ?? 1),
  canvasPosition: {
    x: Number(state.canvasPosition?.x ?? 0),
    y: Number(state.canvasPosition?.y ?? 0),
  },
})

const snapshotSignature = (snapshot) =>
  JSON.stringify({
    restaurantId: snapshot.restaurantId,
    floorId: snapshot.floorId,
    objects: snapshot.objects,
    selectedObjectId: snapshot.selectedObjectId,
    canvasZoom: snapshot.canvasZoom,
    canvasPosition: snapshot.canvasPosition,
  })

export const isSameEditorSnapshot = (left, right) => {
  if (!left || !right) return false
  return snapshotSignature(left) === snapshotSignature(right)
}

export const isSnapshotForCurrentWorkspace = (snapshot, state) =>
  snapshot?.restaurantId === (state.currentRestaurantId ?? null)
  && snapshot?.floorId === (state.currentFloorId ?? null)

export const applyEditorSnapshot = (state, snapshot) => {
  const objects = cloneObjects(snapshot.objects ?? [])
  const selectedObjectId = objects.some((object) => object.id === snapshot.selectedObjectId)
    ? snapshot.selectedObjectId
    : null

  return {
    ...state,
    objects,
    selectedObjectId,
    canvasZoom: Number(snapshot.canvasZoom ?? state.canvasZoom ?? 1),
    canvasPosition: {
      x: Number(snapshot.canvasPosition?.x ?? state.canvasPosition?.x ?? 0),
      y: Number(snapshot.canvasPosition?.y ?? state.canvasPosition?.y ?? 0),
    },
  }
}
