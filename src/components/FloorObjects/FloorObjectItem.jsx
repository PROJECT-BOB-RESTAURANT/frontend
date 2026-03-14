import { memo, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import clsx from 'clsx'
import { ObjectRenderer } from './ObjectRenderer'
import { getAnchorOrigin, snapToGrid } from '../../utils/grid'

const FloorObjectItemComponent = ({
  object,
  selected,
  canvasZoom,
  isEditable,
  onSelect,
}) => {
  const {
    attributes = {},
    listeners = {},
    setNodeRef,
    transform,
  } = useDraggable({
    id: `canvas-${object.id}`,
    data: {
      source: 'canvas',
      objectId: object.id,
    },
    disabled: !isEditable,
  })

  const { onPointerDown: dndPointerDown, ...restListeners } = listeners

  const style = useMemo(
    () => ({
      left: object.x,
      top: object.y,
      width: object.width,
      height: object.height,
      transform: `${CSS.Translate.toString({
        x: snapToGrid((transform?.x ?? 0) / canvasZoom) * canvasZoom,
        y: snapToGrid((transform?.y ?? 0) / canvasZoom) * canvasZoom,
      })} rotate(${object.rotation ?? 0}deg) scale(${object.scaleX ?? 1}, ${object.scaleY ?? 1})`,
      transformOrigin: getAnchorOrigin(object.metadata?.anchor ?? 'top-left'),
    }),
    [
      object.x,
      object.y,
      object.width,
      object.height,
      object.rotation,
      object.scaleX,
      object.scaleY,
      object.metadata?.anchor,
      transform,
      canvasZoom,
    ],
  )

  const scaleX = object.scaleX ?? 1
  const scaleY = object.scaleY ?? 1
  const label = object.metadata?.label ?? object.type
  const labelStyle = {
    transform: `translate(-50%, -50%) scale(${1 / scaleX}, ${1 / scaleY})`,
    transformOrigin: 'center center',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-floor-object="true"
      className={clsx(
        'absolute touch-none select-none',
        isEditable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        selected && 'z-30 ring-2 ring-sky-500 ring-offset-2 ring-offset-transparent',
      )}
      onMouseDown={(event) => {
        event.stopPropagation()
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect(object.id)
        if (isEditable) {
          dndPointerDown?.(event)
        }
      }}
      {...restListeners}
      {...attributes}
    >
      <div className="absolute inset-0">
        <ObjectRenderer object={object} />
      </div>

      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 rounded bg-white/75 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-800"
        style={labelStyle}
      >
        {label}
      </div>
    </div>
  )
}

export const FloorObjectItem = memo(FloorObjectItemComponent)
