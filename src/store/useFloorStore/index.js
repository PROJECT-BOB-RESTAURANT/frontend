import { create } from 'zustand'
import { DEFAULT_CANVAS_POSITION, DEFAULT_CANVAS_ZOOM } from './constants'
import { createFloorStoreActions } from './actions'

export const useFloorStore = create((set, get) => ({
  page: 'restaurant-management',
  editorMode: 'edit',
  reservationPreviewAt: null,
  waiterTableId: null,
  waiterWorkerId: null,
  waiterActiveSection: 'orders',
  restaurants: [],
  currentRestaurantId: null,
  floors: [],
  currentFloorId: null,

  objects: [],
  selectedObjectId: null,
  canvasZoom: DEFAULT_CANVAS_ZOOM,
  canvasPosition: { ...DEFAULT_CANVAS_POSITION },
  snapEnabled: true,
  editorUndoStack: [],
  editorRedoStack: [],

  ...createFloorStoreActions(set, get),
}))
