import { create } from 'zustand'
import { snapToGrid, GRID_SIZE, clamp } from '../utils/grid'

const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.5
const MIN_SIZE = GRID_SIZE
const MIN_SCALE = 0.4
const MAX_SCALE = 5

const createId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`

const normalizeObject = (obj) => {
  const fallbackScale = Number(obj.scale ?? 1)

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
      seats: obj.metadata?.seats ?? obj.seats ?? 0,
      label: obj.metadata?.label ?? obj.label ?? obj.type,
      anchor: obj.metadata?.anchor ?? 'top-left',
      fillColor: obj.metadata?.fillColor ?? null,
      strokeColor: obj.metadata?.strokeColor ?? null,
      ...obj.metadata,
    },
  }
}

const createFloor = (name, size) => ({
  id: createId('floor'),
  name,
  objects: [],
  size: size ?? null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  canvasZoom: 1,
  canvasPosition: { x: 160, y: 90 },
})

const cloneObjects = (objects) => objects.map((obj) => ({ ...obj, metadata: { ...obj.metadata } }))

const persistCurrentFloor = (state) => {
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

const loadFloorIntoEditor = (state, floorId) => {
  const floor = state.floors.find((item) => item.id === floorId)
  if (!floor) return state

  return {
    ...state,
    currentFloorId: floor.id,
    objects: cloneObjects(floor.objects),
    canvasZoom: floor.canvasZoom ?? 1,
    canvasPosition: floor.canvasPosition ?? { x: 160, y: 90 },
    selectedObjectId: null,
  }
}

const defaultFloor = createFloor('Ground Floor')

export const useFloorStore = create((set, get) => ({
  page: 'management',
  editorMode: 'edit',
  floors: [defaultFloor],
  currentFloorId: defaultFloor.id,

  objects: [],
  selectedObjectId: null,
  canvasZoom: 1,
  canvasPosition: { x: 160, y: 90 },
  snapEnabled: true,

  setSnapEnabled: (enabled) => set({ snapEnabled: Boolean(enabled) }),
  setSelectedObject: (id) => set({ selectedObjectId: id }),

  createFloor: (name, size) => {
    const floor = createFloor(name?.trim() || `Floor ${get().floors.length + 1}`, size)
    set((state) => ({
      floors: [...state.floors, floor],
    }))
    return floor.id
  },

  renameFloor: (floorId, name) => {
    const nextName = name?.trim()
    if (!nextName) return

    set((state) => ({
      floors: state.floors.map((floor) =>
        floor.id === floorId
          ? {
              ...floor,
              name: nextName,
              updatedAt: Date.now(),
            }
          : floor,
      ),
    }))
  },

  deleteFloor: (floorId) => {
    set((state) => {
      const persistedFloors = persistCurrentFloor(state)
      const remaining = persistedFloors.filter((floor) => floor.id !== floorId)
      const nextFloors = remaining.length > 0 ? remaining : [createFloor('Ground Floor')]
      const nextCurrentId = nextFloors[0].id

      const nextState = loadFloorIntoEditor(
        {
          ...state,
          floors: nextFloors,
          currentFloorId: nextCurrentId,
        },
        nextCurrentId,
      )

      return {
        ...nextState,
      }
    })
  },

  openFloor: (floorId, mode = 'edit') => {
    set((state) => {
      const persistedFloors = persistCurrentFloor(state)
      const nextState = loadFloorIntoEditor(
        {
          ...state,
          floors: persistedFloors,
        },
        floorId,
      )

      return {
        ...nextState,
        page: 'editor',
        editorMode: mode,
      }
    })
  },

  backToManagement: () => {
    set((state) => ({
      floors: persistCurrentFloor(state),
      page: 'management',
      selectedObjectId: null,
    }))
  },

  switchFloorInEditor: (floorId) => {
    set((state) => {
      const persistedFloors = persistCurrentFloor(state)
      return loadFloorIntoEditor(
        {
          ...state,
          floors: persistedFloors,
        },
        floorId,
      )
    })
  },

  setEditorMode: (mode) => set({ editorMode: mode }),

  addObjectFromPreset: (preset, x, y) => {
    const snapEnabled = get().snapEnabled
    const object = normalizeObject({
      ...preset.config,
      x: snapEnabled ? snapToGrid(x) : x,
      y: snapEnabled ? snapToGrid(y) : y,
    })

    set((state) => ({
      objects: [...state.objects, object],
      selectedObjectId: object.id,
    }))

    return object.id
  },

  updateObject: (id, updates) => {
    const snapEnabled = get().snapEnabled
    const normalizedUpdates = { ...updates }
    if (normalizedUpdates.scale !== undefined) {
      normalizedUpdates.scaleX = normalizedUpdates.scale
      normalizedUpdates.scaleY = normalizedUpdates.scale
      delete normalizedUpdates.scale
    }

    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== id) return obj

        const next = {
          ...obj,
          ...normalizedUpdates,
          metadata: {
            ...obj.metadata,
            ...normalizedUpdates.metadata,
          },
        }

        return {
          ...next,
          x:
            normalizedUpdates.x !== undefined
              ? snapEnabled
                ? snapToGrid(next.x)
                : next.x
              : next.x,
          y:
            normalizedUpdates.y !== undefined
              ? snapEnabled
                ? snapToGrid(next.y)
                : next.y
              : next.y,
          width:
            normalizedUpdates.width !== undefined
              ? Math.max(MIN_SIZE, snapEnabled ? snapToGrid(next.width) : next.width)
              : next.width,
          height:
            normalizedUpdates.height !== undefined
              ? Math.max(MIN_SIZE, snapEnabled ? snapToGrid(next.height) : next.height)
              : next.height,
          rotation:
            normalizedUpdates.rotation !== undefined ? Number(next.rotation) : obj.rotation,
          scaleX:
            normalizedUpdates.scaleX !== undefined
              ? clamp(Number(next.scaleX), MIN_SCALE, MAX_SCALE)
              : obj.scaleX,
          scaleY:
            normalizedUpdates.scaleY !== undefined
              ? clamp(Number(next.scaleY), MIN_SCALE, MAX_SCALE)
              : obj.scaleY,
        }
      }),
    }))
  },

  moveObjectByDelta: (id, dx, dy) => {
    const object = get().objects.find((item) => item.id === id)
    if (!object) return

    get().updateObject(id, {
      x: object.x + dx,
      y: object.y + dy,
    })
  },

  deleteSelectedObject: () => {
    if (get().editorMode !== 'edit') return

    const selectedObjectId = get().selectedObjectId
    if (!selectedObjectId) return

    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== selectedObjectId),
      selectedObjectId: null,
    }))
  },

  duplicateSelectedObject: () => {
    if (get().editorMode !== 'edit') return

    const selectedObjectId = get().selectedObjectId
    if (!selectedObjectId) return

    const source = get().objects.find((obj) => obj.id === selectedObjectId)
    if (!source) return

    const duplicated = normalizeObject({
      ...source,
      id: createId('obj'),
      x: source.x + GRID_SIZE * 2,
      y: source.y + GRID_SIZE * 2,
      metadata: {
        ...source.metadata,
        label: `${source.metadata?.label ?? source.type} Copy`,
      },
    })

    set((state) => ({
      objects: [...state.objects, duplicated],
      selectedObjectId: duplicated.id,
    }))
  },

  setCanvasZoom: (zoom) => set({ canvasZoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) }),

  panCanvasBy: (dx, dy) => {
    set((state) => ({
      canvasPosition: {
        x: state.canvasPosition.x + dx,
        y: state.canvasPosition.y + dy,
      },
    }))
  },

  setCanvasPosition: (next) => set({ canvasPosition: next }),

  clearSelection: () => set({ selectedObjectId: null }),

  exportLayout: () => {
    const state = get()
    const persistedFloors = persistCurrentFloor(state)
    return JSON.stringify(
      {
        floors: persistedFloors.map((floor) => ({
          id: floor.id,
          name: floor.name,
          size: floor.size ?? null,
          createdAt: floor.createdAt,
          updatedAt: floor.updatedAt,
          objects: floor.objects.map((obj) => ({
            id: obj.id,
            type: obj.type,
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
            rotation: obj.rotation,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            seats: obj.metadata?.seats ?? 0,
            label: obj.metadata?.label ?? '',
            metadata: obj.metadata,
          })),
        })),
      },
      null,
      2,
    )
  },

  loadLayout: (payload) => {
    const parsed = JSON.parse(payload)

    if (Array.isArray(parsed.objects)) {
      // Backward compatibility for single-floor schema
      const legacyFloor = createFloor('Imported Floor')
      legacyFloor.objects = parsed.objects.map((obj) => normalizeObject(obj))
      legacyFloor.updatedAt = Date.now()

      set({
        floors: [legacyFloor],
        currentFloorId: legacyFloor.id,
        objects: cloneObjects(legacyFloor.objects),
        selectedObjectId: null,
      })
      return
    }

    if (!Array.isArray(parsed.floors)) {
      throw new Error('Layout JSON must include a floors array')
    }

    const floors = parsed.floors.map((floor, index) => ({
      id: floor.id ?? createId('floor'),
      name: floor.name ?? `Floor ${index + 1}`,
      size: floor.size ?? null,
      createdAt: floor.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      canvasZoom: floor.canvasZoom ?? 1,
      canvasPosition: floor.canvasPosition ?? { x: 160, y: 90 },
      objects: Array.isArray(floor.objects)
        ? floor.objects.map((obj) => normalizeObject(obj))
        : [],
    }))

    const firstFloor = floors[0] ?? createFloor('Ground Floor')

    set({
      floors: floors.length > 0 ? floors : [firstFloor],
      currentFloorId: firstFloor.id,
      objects: cloneObjects(firstFloor.objects),
      canvasZoom: firstFloor.canvasZoom,
      canvasPosition: firstFloor.canvasPosition,
      selectedObjectId: null,
    })
  },
}))
