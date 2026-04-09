import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

const LibraryItemComponent = ({ item }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${item.id}`,
    data: {
      source: 'library',
      presetId: item.id,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className="min-h-12 w-full touch-none rounded-xl border border-slate-200 bg-white/80 p-3 text-left text-sm font-medium text-slate-800 transition hover:border-sky-300 hover:bg-sky-50 active:cursor-grabbing"
      data-dragging={isDragging}
    >
      {item.label}
    </button>
  )
}

export const LibraryItem = memo(LibraryItemComponent)
