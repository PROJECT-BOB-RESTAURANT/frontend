import { useEffect } from 'react'
import { useFloorStore } from '../store/useFloorStore'

export const useKeyboardShortcuts = () => {
  const page = useFloorStore((state) => state.page)
  const deleteSelectedObject = useFloorStore((state) => state.deleteSelectedObject)
  const duplicateSelectedObject = useFloorStore((state) => state.duplicateSelectedObject)
  const undoEditorChange = useFloorStore((state) => state.undoEditorChange)
  const redoEditorChange = useFloorStore((state) => state.redoEditorChange)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (page !== 'editor') return

      const tagName = event.target?.tagName
      const isTyping =
        tagName === 'INPUT' || tagName === 'TEXTAREA' || event.target?.isContentEditable

      if (isTyping) return

      const isMeta = event.ctrlKey || event.metaKey
      const key = String(event.key ?? '').toLowerCase()

      if (isMeta && key === 'z' && event.shiftKey) {
        event.preventDefault()
        redoEditorChange()
        return
      }

      if (isMeta && key === 'z') {
        event.preventDefault()
        undoEditorChange()
        return
      }

      if (isMeta && key === 'y') {
        event.preventDefault()
        redoEditorChange()
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelectedObject()
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        duplicateSelectedObject()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [
    page,
    deleteSelectedObject,
    duplicateSelectedObject,
    undoEditorChange,
    redoEditorChange,
  ])
}
