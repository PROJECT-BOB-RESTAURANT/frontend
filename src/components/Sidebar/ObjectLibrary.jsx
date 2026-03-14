import { OBJECT_LIBRARY } from '../../utils/objectLibrary'
import { useFloorStore } from '../../store/useFloorStore'
import { LibraryItem } from './LibraryItem'
import { useState } from 'react'

export const ObjectLibrary = () => {
  const selectedObject = useFloorStore((state) =>
    state.objects.find((item) => item.id === state.selectedObjectId) ?? null,
  )
  const updateObject = useFloorStore((state) => state.updateObject)
  const deleteSelectedObject = useFloorStore((state) => state.deleteSelectedObject)
  const duplicateSelectedObject = useFloorStore((state) => state.duplicateSelectedObject)
  const snapEnabled = useFloorStore((state) => state.snapEnabled)
  const setSnapEnabled = useFloorStore((state) => state.setSnapEnabled)
  const exportLayout = useFloorStore((state) => state.exportLayout)
  const loadLayout = useFloorStore((state) => state.loadLayout)

  const [layoutText, setLayoutText] = useState('')
  const [layoutFeedback, setLayoutFeedback] = useState('')

  const downloadLayout = () => {
    const data = exportLayout()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `floor-layout-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setLayoutFeedback('Exported JSON file.')
  }

  const saveLayout = () => {
    const data = exportLayout()
    localStorage.setItem('floor-layout', data)
    setLayoutText(data)
    setLayoutFeedback('Saved to browser storage.')
  }

  const loadSavedLayout = () => {
    const saved = localStorage.getItem('floor-layout')
    if (!saved) {
      setLayoutFeedback('No saved layout found.')
      return
    }

    loadLayout(saved)
    setLayoutText(saved)
    setLayoutFeedback('Loaded saved layout.')
  }

  const importLayout = () => {
    try {
      loadLayout(layoutText)
      setLayoutFeedback('Imported layout JSON.')
    } catch (error) {
      setLayoutFeedback(error.message)
    }
  }

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-slate-200 bg-white/70 backdrop-blur">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Object Library
        </h2>
        <p className="mt-1 text-xs text-slate-500">Drag items onto the floor.</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <div className="grid grid-cols-1 gap-2">
          {OBJECT_LIBRARY.map((item) => (
            <LibraryItem key={item.id} item={item} />
          ))}
        </div>

        <div className="border-t border-slate-200 pt-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600">
            Snap To Grid
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(event) => setSnapEnabled(event.target.checked)}
            />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Selected Object
          </h3>

          {selectedObject ? (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Rotation
                  <input
                    className="rounded-md border border-slate-200 px-2 py-1"
                    type="number"
                    step="5"
                    value={selectedObject.rotation ?? 0}
                    onChange={(event) =>
                      updateObject(selectedObject.id, {
                        rotation: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Scale X
                  <input
                    className="rounded-md border border-slate-200 px-2 py-1"
                    type="number"
                    step="0.1"
                    min="0.4"
                    max="5"
                    value={selectedObject.scaleX ?? 1}
                    onChange={(event) =>
                      updateObject(selectedObject.id, {
                        scaleX: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Scale Y
                  <input
                    className="rounded-md border border-slate-200 px-2 py-1"
                    type="number"
                    step="0.1"
                    min="0.4"
                    max="5"
                    value={selectedObject.scaleY ?? 1}
                    onChange={(event) =>
                      updateObject(selectedObject.id, {
                        scaleY: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>

              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Name
                <input
                  className="rounded-md border border-slate-200 px-2 py-1"
                  type="text"
                  value={selectedObject.metadata?.label ?? ''}
                  onChange={(event) =>
                    updateObject(selectedObject.id, {
                      metadata: { label: event.target.value },
                    })
                  }
                />
              </label>

              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Anchor
                <select
                  className="rounded-md border border-slate-200 px-2 py-1"
                  value={selectedObject.metadata?.anchor ?? 'top-left'}
                  onChange={(event) =>
                    updateObject(selectedObject.id, {
                      metadata: { anchor: event.target.value },
                    })
                  }
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="center">Center</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fill Color
                  <input
                    className="h-8 w-full rounded-md border border-slate-200"
                    type="color"
                    value={selectedObject.metadata?.fillColor ?? '#cbd5e1'}
                    onChange={(event) =>
                      updateObject(selectedObject.id, {
                        metadata: { fillColor: event.target.value },
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stroke Color
                  <input
                    className="h-8 w-full rounded-md border border-slate-200"
                    type="color"
                    value={selectedObject.metadata?.strokeColor ?? '#334155'}
                    onChange={(event) =>
                      updateObject(selectedObject.id, {
                        metadata: { strokeColor: event.target.value },
                      })
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-md bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  onClick={duplicateSelectedObject}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="rounded-md bg-rose-100 px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                  onClick={deleteSelectedObject}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Select an object to edit anchor and colors.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Floor Settings
          </h3>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-md bg-sky-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
              onClick={saveLayout}
            >
              Save
            </button>
            <button
              type="button"
              className="rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              onClick={loadSavedLayout}
            >
              Load
            </button>
            <button
              type="button"
              className="rounded-md bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              onClick={downloadLayout}
            >
              Export
            </button>
            <button
              type="button"
              className="rounded-md bg-amber-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
              onClick={importLayout}
            >
              Import
            </button>
          </div>

          <textarea
            className="mt-2 h-28 w-full rounded-md border border-slate-200 p-2 text-xs"
            placeholder="Paste layout JSON here to import..."
            value={layoutText}
            onChange={(event) => setLayoutText(event.target.value)}
          />

          {layoutFeedback ? (
            <p className="mt-1 text-[11px] text-slate-500">{layoutFeedback}</p>
          ) : null}
        </div>
        </div>
      </div>
    </aside>
  )
}
