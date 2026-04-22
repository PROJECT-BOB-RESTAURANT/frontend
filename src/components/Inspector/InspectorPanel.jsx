import { useFloorStore } from '../../store/useFloorStore'
import { isTableObjectType } from '../../utils/objectLibrary'

const InputRow = ({ label, children }) => (
  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
    {label}
    {children}
  </label>
)

export const InspectorPanel = ({ role }) => {
  const selectedObject = useFloorStore((state) =>
    state.objects.find((item) => item.id === state.selectedObjectId) ?? null,
  )
  const updateObject = useFloorStore((state) => state.updateObject)
  const duplicateSelectedObject = useFloorStore((state) => state.duplicateSelectedObject)
  const openWaiterForTable = useFloorStore((state) => state.openWaiterForTable)
  const editorMode = useFloorStore((state) => state.editorMode)
  const canEdit = editorMode === 'edit'
  const isStaff = role === 'STAFF'
  const canAdjustTransform = canEdit || (!isStaff && role !== undefined)
  const isTable = selectedObject ? isTableObjectType(selectedObject.type) : false
  const showStaffTableOnlyActions = isStaff && !canEdit

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-slate-200 bg-white/75 backdrop-blur">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Inspector</h2>
      </div>

      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4">
        {selectedObject ? (
          showStaffTableOnlyActions ? (
            <>
              {isTable ? (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Table Actions</h3>
                  <p className="text-sm font-semibold text-slate-800">{selectedObject.metadata?.label ?? 'Selected table'}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      className="min-h-11 w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                      onClick={() => openWaiterForTable(selectedObject.id, 'orders')}
                    >
                      Manage Table
                    </button>
                    <button
                      type="button"
                      className="min-h-11 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                      onClick={() => openWaiterForTable(selectedObject.id, 'reservations')}
                    >
                      Manage Reservation
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  Staff can only manage table service. Select a table and tap Manage Table.
                </div>
              )}
            </>
          ) : (
            <>
            <div className="grid grid-cols-2 gap-2">
              <InputRow label="X">
                <input
                  className="min-h-11 rounded-md border border-slate-200 px-3 py-2 text-sm"
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
                  className="min-h-11 rounded-md border border-slate-200 px-3 py-2 text-sm"
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
                  className="min-h-11 rounded-md border border-slate-200 px-3 py-2 text-sm"
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
                  className="min-h-11 rounded-md border border-slate-200 px-3 py-2 text-sm"
                  type="number"
                  value={selectedObject.height}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateObject(selectedObject.id, { height: Number(event.target.value) })
                  }
                />
              </InputRow>
            </div>

            <InputRow label="Name">
              <input
                className="min-h-11 rounded-md border border-slate-200 px-3 py-2 text-sm"
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

            {isTable ? (
              <InputRow label="Max Seats">
                <input
                  className="min-h-11 rounded-md border border-slate-200 px-3 py-2 text-sm"
                  type="number"
                  min="1"
                  step="1"
                  value={selectedObject.metadata?.seats ?? 1}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateObject(selectedObject.id, {
                      metadata: { seats: Number(event.target.value) },
                    })
                  }
                />
              </InputRow>
            ) : null}

            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick Transform</h3>
              <InputRow label="Rotation">
                <input
                  className="min-h-11 rounded-md border border-slate-200 px-3 py-2 text-sm"
                  type="number"
                  value={selectedObject.rotation}
                  disabled={!canAdjustTransform}
                  onChange={(event) =>
                    updateObject(selectedObject.id, { rotation: Number(event.target.value) })
                  }
                />
              </InputRow>

              <div className="grid grid-cols-2 gap-2">
                <InputRow label="Scale X">
                  <input
                    className="min-h-11 rounded-md border border-slate-200 px-3 py-2 text-sm"
                    type="number"
                    step="0.1"
                    min="0.4"
                    max="5"
                    value={selectedObject.scaleX ?? 1}
                    disabled={!canAdjustTransform}
                    onChange={(event) =>
                      updateObject(selectedObject.id, { scaleX: Number(event.target.value) })
                    }
                  />
                </InputRow>
                <InputRow label="Scale Y">
                  <input
                    className="min-h-11 rounded-md border border-slate-200 px-3 py-2 text-sm"
                    type="number"
                    step="0.1"
                    min="0.4"
                    max="5"
                    value={selectedObject.scaleY ?? 1}
                    disabled={!canAdjustTransform}
                    onChange={(event) =>
                      updateObject(selectedObject.id, { scaleY: Number(event.target.value) })
                    }
                  />
                </InputRow>
              </div>
            </div>

            <button
              type="button"
              className="min-h-11 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              disabled={!canEdit}
              onClick={duplicateSelectedObject}
            >
              Duplicate Selected
            </button>

            {!canEdit && isTable ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="min-h-11 w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                  onClick={() => openWaiterForTable(selectedObject.id, 'orders')}
                >
                  Manage Table
                </button>
                <button
                  type="button"
                  className="min-h-11 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                  onClick={() => openWaiterForTable(selectedObject.id, 'reservations')}
                >
                  Manage Reservation
                </button>
              </div>
            ) : null}
            </>
          )
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            {showStaffTableOnlyActions
              ? 'Select a table and tap Manage Table.'
              : 'Select an object to edit its properties.'}
          </div>
        )}
      </div>
    </aside>
  )
}
