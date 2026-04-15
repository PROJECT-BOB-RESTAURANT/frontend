import { snapToGrid, toWorldPoint } from '../../utils/grid'
import { getObjectPreset } from '../../utils/objectLibrary'

export const createOnDragEnd = ({
  editorMode,
  role,
  canvasPosition,
  canvasZoom,
  snapEnabled,
  addObjectFromPreset,
  moveObjectByDelta,
}) => {
  return (event) => {
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
  }
}
