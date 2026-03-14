import { useEffect } from 'react'
import { useFloorStore } from '../store/useFloorStore'

export const useKeyboardShortcuts = () => {
  const deleteSelectedObject = useFloorStore((state) => state.deleteSelectedObject)
  const duplicateSelectedObject = useFloorStore((state) => state.duplicateSelectedObject)

  useEffect(() => {
    const onKeyDown = (event) => {
      const tagName = event.target?.tagName
      const isTyping =
        tagName === 'INPUT' || tagName === 'TEXTAREA' || event.target?.isContentEditable

      if (isTyping) return

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
  }, [deleteSelectedObject, duplicateSelectedObject])
}
