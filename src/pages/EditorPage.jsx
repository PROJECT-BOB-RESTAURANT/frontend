import { useEffect, useRef, useState } from 'react'
import { DndContext } from '@dnd-kit/core'
import { PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { CanvasEditor } from '../components/Canvas/CanvasEditor'
import { InspectorPanel } from '../components/Inspector/InspectorPanel'
import { ObjectLibrary } from '../components/Sidebar/ObjectLibrary'
import { useFloorStore } from '../store/useFloorStore'

const INSPECTOR_WIDTH_MIN = 240
const INSPECTOR_WIDTH_MAX = 620
const INSPECTOR_WIDTH_DEFAULT = 320
const INSPECTOR_HEIGHT_MIN = 150
const INSPECTOR_HEIGHT_MAX = 520
const INSPECTOR_HEIGHT_DEFAULT = 200
const STATUS_TIME_STEP_MINUTES = 30

const toDateTimeLocalInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function EditorPage({
  role,
  onDragEnd,
  editorMode,
  isBackendLoading,
  backendFeedback,
  currentRestaurantId,
  restaurants,
  currentFloorId,
  floors,
  onBackToManagement,
  onBackToRestaurants,
  onSwitchRestaurantInEditor,
  onSwitchFloorInEditor,
  onSaveCurrentFloorLayout,
  onSetEditorMode,
}) {
  const isStaff = role === 'STAFF'
  const reservationPreviewAt = useFloorStore((state) => state.reservationPreviewAt)
  const setReservationPreviewAt = useFloorStore((state) => state.setReservationPreviewAt)
  const undoEditorChange = useFloorStore((state) => state.undoEditorChange)
  const redoEditorChange = useFloorStore((state) => state.redoEditorChange)
  const canUndo = useFloorStore((state) => state.editorUndoStack.length > 0)
  const canRedo = useFloorStore((state) => state.editorRedoStack.length > 0)
  const [statusTimeInput, setStatusTimeInput] = useState(() => toDateTimeLocalInput(reservationPreviewAt))
  const [inspectorWidth, setInspectorWidth] = useState(() => {
    const stored = Number(localStorage.getItem('editor-inspector-width'))
    if (Number.isNaN(stored) || stored <= 0) {
      return INSPECTOR_WIDTH_DEFAULT
    }

    return Math.min(INSPECTOR_WIDTH_MAX, Math.max(INSPECTOR_WIDTH_MIN, stored))
  })
  const [inspectorHeight, setInspectorHeight] = useState(() => {
    const stored = Number(localStorage.getItem('editor-inspector-height'))
    if (Number.isNaN(stored) || stored <= 0) {
      return INSPECTOR_HEIGHT_DEFAULT
    }

    return Math.min(INSPECTOR_HEIGHT_MAX, Math.max(INSPECTOR_HEIGHT_MIN, stored))
  })
  const resizeState = useRef(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 80,
        tolerance: 8,
      },
    }),
  )

  useEffect(() => {
    localStorage.setItem('editor-inspector-width', String(inspectorWidth))
  }, [inspectorWidth])

  useEffect(() => {
    localStorage.setItem('editor-inspector-height', String(inspectorHeight))
  }, [inspectorHeight])

  useEffect(() => {
    setStatusTimeInput(toDateTimeLocalInput(reservationPreviewAt))
  }, [reservationPreviewAt])

  useEffect(() => {
    const onPointerMove = (event) => {
      if (!resizeState.current) {
        return
      }

      if (resizeState.current.axis === 'x') {
        const { startX, startWidth } = resizeState.current
        const nextWidth = startWidth + (startX - event.clientX)
        const clampedWidth = Math.min(
          INSPECTOR_WIDTH_MAX,
          Math.max(INSPECTOR_WIDTH_MIN, nextWidth),
        )
        setInspectorWidth(clampedWidth)
        return
      }

      const { startY, startHeight } = resizeState.current
      const nextHeight = startHeight + (startY - event.clientY)
      const clampedHeight = Math.min(INSPECTOR_HEIGHT_MAX, Math.max(INSPECTOR_HEIGHT_MIN, nextHeight))
      setInspectorHeight(clampedHeight)
    }

    const onPointerUp = () => {
      resizeState.current = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [])

  const startInspectorResize = (event) => {
    const isMobileLayout = window.innerWidth <= 1024
    resizeState.current = {
      axis: isMobileLayout ? 'y' : 'x',
      startX: event.clientX,
      startWidth: inspectorWidth,
      startY: event.clientY,
      startHeight: inspectorHeight,
    }
  }

  const shiftStatusTimeByMinutes = (minutes) => {
    const baseDate = reservationPreviewAt ? new Date(reservationPreviewAt) : new Date()
    if (Number.isNaN(baseDate.getTime())) {
      return
    }

    const nextDate = new Date(baseDate.getTime() + minutes * 60 * 1000)
    const nextInputValue = toDateTimeLocalInput(nextDate.toISOString())
    setStatusTimeInput(nextInputValue)
    setReservationPreviewAt(nextInputValue)
  }

  return (
    <DndContext onDragEnd={onDragEnd} sensors={sensors}>
      <main className="h-screen overflow-hidden bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 backdrop-blur">
          <button
            type="button"
            className="min-h-11 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            onClick={onBackToManagement}
          >
            Back To Floors
          </button>

          <button
            type="button"
            className="min-h-11 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            onClick={onBackToRestaurants}
          >
            Restaurants
          </button>

          <select
            className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={currentRestaurantId ?? ''}
            onChange={(event) => onSwitchRestaurantInEditor(event.target.value)}
          >
            {restaurants.length === 0 ? <option value="">No restaurants</option> : null}
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>

          <select
            className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={currentFloorId ?? ''}
            onChange={(event) => onSwitchFloorInEditor(event.target.value)}
          >
            {floors.length === 0 ? <option value="">No floors</option> : null}
            {floors.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.name}
              </option>
            ))}
          </select>

          <div className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
            <span className="text-xs font-semibold text-slate-500">Time</span>
            <input
              type="datetime-local"
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
              value={statusTimeInput}
              onChange={(event) => {
                const nextValue = event.target.value
                setStatusTimeInput(nextValue)
                setReservationPreviewAt(nextValue)
              }}
            />
            <button
              type="button"
              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              onClick={() => shiftStatusTimeByMinutes(STATUS_TIME_STEP_MINUTES)}
              aria-label="Increase time"
            >
              +30 min
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              onClick={() => shiftStatusTimeByMinutes(-STATUS_TIME_STEP_MINUTES)}
              aria-label="Decrease time"
            >
              -30 min
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              onClick={() => {
                setStatusTimeInput('')
                setReservationPreviewAt(null)
              }}
            >
              Now
            </button>
          </div>

          {!isStaff ? (
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={undoEditorChange}
                disabled={!canUndo}
                title="Undo (Ctrl/Cmd+Z)"
              >
                Undo
              </button>
              <button
                type="button"
                className="min-h-11 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={redoEditorChange}
                disabled={!canRedo}
                title="Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y)"
              >
                Redo
              </button>
              <button
                type="button"
                className="min-h-11 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isBackendLoading}
                onClick={onSaveCurrentFloorLayout}
              >
                {isBackendLoading ? 'Saving...' : 'Save Floor Layout'}
              </button>
              <button
                type="button"
                className={`min-h-11 rounded-md px-4 py-2 text-sm font-semibold ${
                  editorMode === 'view'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                onClick={() => onSetEditorMode('view')}
              >
                View Mode
              </button>
              <button
                type="button"
                className={`min-h-11 rounded-md px-4 py-2 text-sm font-semibold ${
                  editorMode === 'edit'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                onClick={() => onSetEditorMode('edit')}
              >
                Edit Mode
              </button>
            </div>
          ) : null}
        </div>

        {backendFeedback ? (
          <div className="mb-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600">
            {backendFeedback}
          </div>
        ) : null}

        <div
          className="grid h-[calc(100%-52px)] [grid-template-columns:var(--editor-cols)] overflow-hidden rounded-2xl border border-white/60 bg-white/60 shadow-2xl backdrop-blur-md max-lg:grid-cols-1 max-lg:[grid-template-rows:var(--editor-mobile-rows)]"
          style={{
            '--editor-cols':
              !isStaff && editorMode === 'edit'
                ? `300px 1fr 10px ${inspectorWidth}px`
                : `1fr 10px ${inspectorWidth}px`,
            '--editor-mobile-rows':
              !isStaff && editorMode === 'edit'
                ? `105px minmax(0, 1fr) 10px ${inspectorHeight}px`
                : `minmax(0, 1fr) 10px ${inspectorHeight}px`,
          }}
        >
          {!isStaff && editorMode === 'edit' ? <ObjectLibrary /> : null}
          <CanvasEditor />
          <div className="relative flex h-full items-stretch justify-center bg-slate-100/80 max-lg:h-full max-lg:w-full">
            <button
              type="button"
              className="h-full w-full touch-none border-slate-200 bg-slate-100/80 hover:bg-slate-200/70 lg:cursor-col-resize lg:border-l lg:border-r max-lg:cursor-row-resize max-lg:border-y"
              aria-label="Resize inspector panel"
              onPointerDown={startInspectorResize}
            >
              <span className="sr-only">Drag to resize inspector panel</span>
            </button>
          </div>
          <InspectorPanel role={role} />
        </div>
      </main>
    </DndContext>
  )
}

export { EditorPage }
