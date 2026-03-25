import { DndContext } from '@dnd-kit/core'
import { CanvasEditor } from '../components/Canvas/CanvasEditor'
import { InspectorPanel } from '../components/Inspector/InspectorPanel'
import { ObjectLibrary } from '../components/Sidebar/ObjectLibrary'

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

  return (
    <DndContext onDragEnd={onDragEnd}>
      <main className="h-screen overflow-hidden bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-4">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 backdrop-blur">
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            onClick={onBackToManagement}
          >
            Back To Floors
          </button>

          <button
            type="button"
            className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            onClick={onBackToRestaurants}
          >
            Restaurants
          </button>

          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
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
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
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

          {!isStaff ? (
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isBackendLoading}
                onClick={onSaveCurrentFloorLayout}
              >
                {isBackendLoading ? 'Saving...' : 'Save Floor Layout'}
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
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
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
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
          className="grid h-[calc(100%-52px)] [grid-template-columns:var(--editor-cols)] overflow-hidden rounded-2xl border border-white/60 bg-white/60 shadow-2xl backdrop-blur-md max-lg:grid-cols-1 max-lg:grid-rows-[300px_1fr]"
          style={{
            '--editor-cols': !isStaff && editorMode === 'edit' ? '320px 1fr 320px' : '1fr 320px',
          }}
        >
          {!isStaff && editorMode === 'edit' ? <ObjectLibrary /> : null}
          <CanvasEditor />
          <InspectorPanel />
        </div>
      </main>
    </DndContext>
  )
}

export { EditorPage }
