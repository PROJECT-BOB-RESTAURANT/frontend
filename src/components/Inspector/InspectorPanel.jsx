import { useMemo, useState } from 'react'
import { useFloorStore } from '../../store/useFloorStore'

const InputRow = ({ label, children }) => (
  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
    {label}
    {children}
  </label>
)

export const InspectorPanel = () => {
  const selectedObject = useFloorStore((state) =>
    state.objects.find((item) => item.id === state.selectedObjectId) ?? null,
  )
  const updateObject = useFloorStore((state) => state.updateObject)
  const exportLayout = useFloorStore((state) => state.exportLayout)
  const loadLayout = useFloorStore((state) => state.loadLayout)
  const duplicateSelectedObject = useFloorStore((state) => state.duplicateSelectedObject)
  const editorMode = useFloorStore((state) => state.editorMode)
  const canEdit = editorMode === 'edit'

  const [jsonText, setJsonText] = useState('')
  const [feedback, setFeedback] = useState('')

  const exportPreview = useMemo(() => exportLayout(), [exportLayout])

  const onLoad = () => {
    try {
      loadLayout(jsonText)
      setFeedback('Layout loaded successfully.')
    } catch (error) {
      setFeedback(error.message)
    }
  }

  return (
    <aside className="flex h-full flex-col border-l border-slate-200 bg-white/75 backdrop-blur">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Inspector</h2>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {selectedObject ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <InputRow label="X">
                <input
                  className="rounded-md border border-slate-200 px-2 py-1"
                  type="number"
                  value={selectedObject.x}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateObject(selectedObject.id, { x: Number(event.target.value) })
                  }
                />
              </InputRow>
              <InputRow label="Y">
                <input
                  className="rounded-md border border-slate-200 px-2 py-1"
                  type="number"
                  value={selectedObject.y}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateObject(selectedObject.id, { y: Number(event.target.value) })
                  }
                />
              </InputRow>
              <InputRow label="Width">
                <input
                  className="rounded-md border border-slate-200 px-2 py-1"
                  type="number"
                  value={selectedObject.width}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateObject(selectedObject.id, { width: Number(event.target.value) })
                  }
                />
              </InputRow>
              <InputRow label="Height">
                <input
                  className="rounded-md border border-slate-200 px-2 py-1"
                  type="number"
                  value={selectedObject.height}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateObject(selectedObject.id, { height: Number(event.target.value) })
                  }
                />
              </InputRow>
            </div>

            <InputRow label="Rotation">
              <input
                className="rounded-md border border-slate-200 px-2 py-1"
                type="number"
                value={selectedObject.rotation}
                disabled={!canEdit}
                onChange={(event) =>
                  updateObject(selectedObject.id, { rotation: Number(event.target.value) })
                }
              />
            </InputRow>

            <div className="grid grid-cols-2 gap-2">
              <InputRow label="Scale X">
                <input
                  className="rounded-md border border-slate-200 px-2 py-1"
                  type="number"
                  step="0.1"
                  min="0.4"
                  max="5"
                  value={selectedObject.scaleX ?? 1}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateObject(selectedObject.id, { scaleX: Number(event.target.value) })
                  }
                />
              </InputRow>
              <InputRow label="Scale Y">
                <input
                  className="rounded-md border border-slate-200 px-2 py-1"
                  type="number"
                  step="0.1"
                  min="0.4"
                  max="5"
                  value={selectedObject.scaleY ?? 1}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateObject(selectedObject.id, { scaleY: Number(event.target.value) })
                  }
                />
              </InputRow>
            </div>

            <InputRow label="Name">
              <input
                className="rounded-md border border-slate-200 px-2 py-1"
                type="text"
                value={selectedObject.metadata?.label ?? ''}
                placeholder="Rename object"
                disabled={!canEdit}
                onChange={(event) =>
                  updateObject(selectedObject.id, {
                    metadata: { label: event.target.value },
                  })
                }
              />
            </InputRow>

            <InputRow label="Seats">
              <input
                className="rounded-md border border-slate-200 px-2 py-1"
                type="number"
                value={selectedObject.metadata?.seats ?? 0}
                disabled={!canEdit}
                onChange={(event) =>
                  updateObject(selectedObject.id, {
                    metadata: { seats: Number(event.target.value) },
                  })
                }
              />
            </InputRow>

            <button
              type="button"
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              disabled={!canEdit}
              onClick={duplicateSelectedObject}
            >
              Duplicate Selected
            </button>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            Select an object to edit its properties.
          </div>
        )}

        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Save / Load Layout
          </h3>

          <textarea
            className="h-28 w-full rounded-md border border-slate-200 p-2 text-xs"
            value={jsonText || exportPreview}
            disabled={!canEdit}
            onChange={(event) => setJsonText(event.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
              disabled={!canEdit}
              onClick={() => {
                const next = exportLayout()
                setJsonText(next)
                setFeedback('Layout exported into editor.')
              }}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              disabled={!canEdit}
              onClick={onLoad}
            >
              Load JSON
            </button>
          </div>

          {feedback ? <p className="text-[11px] text-slate-500">{feedback}</p> : null}
        </div>
      </div>
    </aside>
  )
}
