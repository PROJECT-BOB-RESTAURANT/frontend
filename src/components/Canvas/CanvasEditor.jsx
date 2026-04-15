import { useCallback, useMemo, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { FloorObjectItem } from '../FloorObjects/FloorObjectItem'
import { GRID_SIZE, clamp } from '../../utils/grid'
import { useFloorStore } from '../../store/useFloorStore'

const ZOOM_STEP = 0.1
const DEFAULT_CANVAS_ZOOM = 1
const DEFAULT_CANVAS_POSITION = { x: 160, y: 90 }

export const CanvasEditor = () => {
  const objects = useFloorStore((state) => state.objects)
  const selectedObjectId = useFloorStore((state) => state.selectedObjectId)
  const canvasZoom = useFloorStore((state) => state.canvasZoom)
  const canvasPosition = useFloorStore((state) => state.canvasPosition)
  const setSelectedObject = useFloorStore((state) => state.setSelectedObject)
  const setCanvasPosition = useFloorStore((state) => state.setCanvasPosition)
  const panCanvasBy = useFloorStore((state) => state.panCanvasBy)
  const setCanvasZoom = useFloorStore((state) => state.setCanvasZoom)
  const clearSelection = useFloorStore((state) => state.clearSelection)
  const snapEnabled = useFloorStore((state) => state.snapEnabled)
  const editorMode = useFloorStore((state) => state.editorMode)

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: 'floor-canvas',
  })

  const panStateRef = useRef(null)
  const [isPanning, setIsPanning] = useState(false)

  const onSelectObject = useCallback((id) => setSelectedObject(id), [setSelectedObject])

  const onMouseDownCanvas = useCallback(
    (event) => {
      if (event.target.closest('[data-floor-object="true"]')) return

      if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return

      if (event.pointerType !== 'mouse' || event.button === 0) {
        clearSelection()
      }

      panStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: canvasPosition.x,
        originY: canvasPosition.y,
      }

      event.currentTarget.setPointerCapture?.(event.pointerId)
      setIsPanning(true)
      event.preventDefault()
    },
    [canvasPosition.x, canvasPosition.y, clearSelection],
  )

  const onMouseMove = useCallback(
    (event) => {
      const pan = panStateRef.current
      if (!pan) return
      if (pan.pointerId !== undefined && pan.pointerId !== event.pointerId) return

      setCanvasPosition({
        x: pan.originX + (event.clientX - pan.startX),
        y: pan.originY + (event.clientY - pan.startY),
      })
    },
    [setCanvasPosition],
  )

  const onMouseUp = useCallback(() => {
    panStateRef.current = null
    setIsPanning(false)
  }, [])

  const onWheel = useCallback(
    (event) => {
      event.preventDefault()

      if (event.ctrlKey) {
        const next = canvasZoom - Math.sign(event.deltaY) * ZOOM_STEP
        setCanvasZoom(clamp(next, 0.4, 2.5))
        return
      }

      panCanvasBy(-event.deltaX, -event.deltaY)
    },
    [canvasZoom, panCanvasBy, setCanvasZoom],
  )

  const gridStyle = useMemo(() => {
    const baseGrid = snapEnabled ? GRID_SIZE : GRID_SIZE / 2
    const gridPx = Math.max(8, baseGrid * canvasZoom)
    return {
      backgroundImage:
        'linear-gradient(to right, rgba(15,23,42,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.14) 1px, transparent 1px)',
      backgroundSize: `${gridPx}px ${gridPx}px`,
      backgroundPosition: `${canvasPosition.x}px ${canvasPosition.y}px`,
    }
  }, [canvasPosition.x, canvasPosition.y, canvasZoom, snapEnabled])

  const restoreView = useCallback(() => {
    setCanvasZoom(DEFAULT_CANVAS_ZOOM)
    setCanvasPosition(DEFAULT_CANVAS_POSITION)
  }, [setCanvasZoom, setCanvasPosition])

  return (
    <section className="relative h-full w-full overflow-hidden" onWheel={onWheel}>
      <div className="absolute right-4 top-4 z-50 flex gap-2 rounded-xl border border-slate-200 bg-white/90 p-2 shadow-lg">
        <button
          type="button"
          className="rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold hover:bg-slate-200"
          onClick={() => setCanvasZoom(canvasZoom - ZOOM_STEP)}
        >
          -
        </button>
        <span className="flex items-center px-1 text-xs font-semibold text-slate-600">
          {Math.round(canvasZoom * 100)}%
        </span>
        <button
          type="button"
          className="rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold hover:bg-slate-200"
          onClick={() => setCanvasZoom(canvasZoom + ZOOM_STEP)}
        >
          +
        </button>
        {editorMode === 'view' ? (
          <button
            type="button"
            className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500"
            onClick={restoreView}
          >
            Restore View
          </button>
        ) : null}
      </div>

      <div
        ref={setDroppableRef}
        className="relative h-full w-full touch-none bg-slate-100"
        style={gridStyle}
        onPointerDown={onMouseDownCanvas}
        onPointerMove={onMouseMove}
        onPointerUp={onMouseUp}
        onPointerCancel={onMouseUp}
        onPointerLeave={onMouseUp}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`,
            transformOrigin: '0 0',
          }}
        >
          {objects.map((object) => (
            <FloorObjectItem
              key={object.id}
              object={object}
              selected={selectedObjectId === object.id}
              canvasZoom={canvasZoom}
              isEditable={editorMode === 'edit'}
              onSelect={onSelectObject}
            />
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-slate-900/85 px-3 py-1 text-[11px] text-slate-100">
        Scroll or drag empty space to pan. Ctrl + wheel to zoom.
      </div>

      {isPanning && (
        <div className="pointer-events-none absolute inset-0 cursor-grabbing" />
      )}
    </section>
  )
}
