import { DndContext } from '@dnd-kit/core'
import { CanvasEditor } from './components/Canvas/CanvasEditor'
import { GuestReservationPage } from './components/Guest/GuestReservationPage'
import { InspectorPanel } from './components/Inspector/InspectorPanel'
import { RestaurantGoodsManager } from './components/Management/RestaurantGoodsManager'
import { ObjectLibrary } from './components/Sidebar/ObjectLibrary'
import { WaiterPanel } from './components/Waiter/WaiterPanel'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useFloorStore } from './store/useFloorStore'
import { getObjectPreset } from './utils/objectLibrary'
import { snapToGrid, toWorldPoint } from './utils/grid'

const countFolders = (folders) => {
  if (!Array.isArray(folders)) return 0
  return folders.reduce((sum, folder) => sum + 1 + countFolders(folder.folders), 0)
}

const getTodayName = () => {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return names[new Date().getDay()]
}

const formatTodayOpeningHours = (restaurant) => {
  const today = getTodayName()
  const hours = restaurant?.openingHours ?? []
  const entry = hours.find((item) => item.day === today)
  if (!entry) return `${today}: not set`
  if (entry.isClosed) return `${today}: closed`
  return `${today}: ${entry.open} - ${entry.close}`
}

function App() {
  const addObjectFromPreset = useFloorStore((state) => state.addObjectFromPreset)
  const moveObjectByDelta = useFloorStore((state) => state.moveObjectByDelta)
  const canvasZoom = useFloorStore((state) => state.canvasZoom)
  const canvasPosition = useFloorStore((state) => state.canvasPosition)
  const snapEnabled = useFloorStore((state) => state.snapEnabled)
  const page = useFloorStore((state) => state.page)
  const editorMode = useFloorStore((state) => state.editorMode)
  const restaurants = useFloorStore((state) => state.restaurants)
  const currentRestaurantId = useFloorStore((state) => state.currentRestaurantId)
  const floors = useFloorStore((state) => state.floors)
  const currentFloorId = useFloorStore((state) => state.currentFloorId)
  const createRestaurant = useFloorStore((state) => state.createRestaurant)
  const renameRestaurant = useFloorStore((state) => state.renameRestaurant)
  const deleteRestaurant = useFloorStore((state) => state.deleteRestaurant)
  const openRestaurant = useFloorStore((state) => state.openRestaurant)
  const openGuestReservationPage = useFloorStore((state) => state.openGuestReservationPage)
  const switchRestaurantInManagement = useFloorStore((state) => state.switchRestaurantInManagement)
  const switchRestaurantInEditor = useFloorStore((state) => state.switchRestaurantInEditor)
  const backToRestaurants = useFloorStore((state) => state.backToRestaurants)
  const createFloor = useFloorStore((state) => state.createFloor)
  const renameFloor = useFloorStore((state) => state.renameFloor)
  const deleteFloor = useFloorStore((state) => state.deleteFloor)
  const openFloor = useFloorStore((state) => state.openFloor)
  const backToManagement = useFloorStore((state) => state.backToManagement)
  const switchFloorInEditor = useFloorStore((state) => state.switchFloorInEditor)
  const setEditorMode = useFloorStore((state) => state.setEditorMode)

  const currentRestaurant =
    restaurants.find((restaurant) => restaurant.id === currentRestaurantId) ?? null

  useKeyboardShortcuts()

  const onDragEnd = (event) => {
    const { active, over, delta, activatorEvent } = event
    if (editorMode !== 'edit') return

    if (!over || over.id !== 'floor-canvas') return

    const data = active.data.current
    if (!data || !activatorEvent || !('clientX' in activatorEvent)) return

    const overRect = over.rect?.current ?? over.rect
    if (!overRect || overRect.left === undefined || overRect.top === undefined) return

    if (data.source === 'library') {
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
      moveObjectByDelta(
        data.objectId,
        snapEnabled ? snapToGrid(delta.x / canvasZoom) : delta.x / canvasZoom,
        snapEnabled ? snapToGrid(delta.y / canvasZoom) : delta.y / canvasZoom,
      )
    }
  }

  if (page === 'restaurant-management') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-6">
        <section className="mx-auto max-w-5xl rounded-2xl border border-white/70 bg-white/75 p-6 shadow-2xl backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800">Restaurants</h1>
              <p className="text-sm text-slate-500">Create, view, and manage restaurant locations.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                onClick={openGuestReservationPage}
              >
                Guest Reservation Page
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                onClick={() => {
                  const name = window.prompt('Restaurant name', `Restaurant ${restaurants.length + 1}`)
                  if (!name) return

                  const restaurantId = createRestaurant(name)
                  openRestaurant(restaurantId)
                }}
              >
                Add New Restaurant
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {restaurants.map((restaurant) => (
              <article key={restaurant.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-bold text-slate-800">{restaurant.name}</h2>
                <p className="mt-1 text-xs text-slate-500">Floors: {restaurant.floors.length}</p>
                <p className="text-xs text-slate-500">Workers: {restaurant.workers?.length ?? 0}</p>
                <p className="text-xs text-slate-500">
                  Menu folders: {countFolders(restaurant.goodsCatalog ?? restaurant.goodsCategories ?? [])}
                </p>
                <p className="text-xs text-slate-500">
                  {formatTodayOpeningHours(restaurant)}
                </p>
                <p className="text-xs text-slate-500">
                  Updated: {new Date(restaurant.updatedAt).toLocaleString()}
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500"
                    onClick={() => openRestaurant(restaurant.id)}
                  >
                    Open Floors
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-400"
                    onClick={() => {
                      const nextName = window.prompt('Rename restaurant', restaurant.name)
                      if (!nextName) return
                      renameRestaurant(restaurant.id, nextName)
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-500"
                    onClick={() => deleteRestaurant(restaurant.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    )
  }

  if (page === 'management') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-6">
        <section className="mx-auto max-w-5xl rounded-2xl border border-white/70 bg-white/75 p-6 shadow-2xl backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800">
                {currentRestaurant?.name ?? 'Restaurant'} Floors
              </h1>
              <p className="text-sm text-slate-500">Create, view, and manage floors for this restaurant.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                onClick={backToRestaurants}
              >
                Back To Restaurants
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                onClick={() => {
                  const name = window.prompt('Floor name', `Floor ${floors.length + 1}`)
                  if (!name) return
                  const width = window.prompt('Optional floor width (leave empty to skip)', '')
                  const height = window.prompt('Optional floor height (leave empty to skip)', '')
                  const size =
                    width && height
                      ? { width: Number(width) || null, height: Number(height) || null }
                      : null

                  const floorId = createFloor(name, size)
                  openFloor(floorId, 'edit')
                }}
              >
                Add New Floor
              </button>
            </div>
          </div>

          <div className="mb-4 max-w-sm">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Restaurant
            </label>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={currentRestaurantId}
              onChange={(event) => switchRestaurantInManagement(event.target.value)}
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {floors.map((floor) => (
              <article key={floor.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-bold text-slate-800">{floor.name}</h2>
                <p className="mt-1 text-xs text-slate-500">Objects: {floor.objects.length}</p>
                {floor.size?.width && floor.size?.height ? (
                  <p className="text-xs text-slate-500">
                    Size: {floor.size.width} x {floor.size.height}
                  </p>
                ) : null}
                <p className="text-xs text-slate-500">
                  Updated: {new Date(floor.updatedAt).toLocaleString()}
                </p>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    onClick={() => openFloor(floor.id, 'view')}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500"
                    onClick={() => openFloor(floor.id, 'edit')}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-400"
                    onClick={() => {
                      const nextName = window.prompt('Rename floor', floor.name)
                      if (!nextName) return
                      renameFloor(floor.id, nextName)
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-500"
                    onClick={() => deleteFloor(floor.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          <RestaurantGoodsManager />
        </section>
      </main>
    )
  }

  if (page === 'waiter-management') {
    return <WaiterPanel />
  }

  if (page === 'guest-reservation') {
    return <GuestReservationPage />
  }

  return (
    <DndContext onDragEnd={onDragEnd}>
      <main className="h-screen overflow-hidden bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-4">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 backdrop-blur">
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            onClick={backToManagement}
          >
            Back To Floors
          </button>

          <button
            type="button"
            className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            onClick={backToRestaurants}
          >
            Restaurants
          </button>

          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
            value={currentRestaurantId}
            onChange={(event) => switchRestaurantInEditor(event.target.value)}
          >
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
            value={currentFloorId}
            onChange={(event) => switchFloorInEditor(event.target.value)}
          >
            {floors.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.name}
              </option>
            ))}
          </select>

          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                editorMode === 'view'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => setEditorMode('view')}
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
              onClick={() => setEditorMode('edit')}
            >
              Edit Mode
            </button>
          </div>
        </div>

        <div
          className="grid h-[calc(100%-52px)] [grid-template-columns:var(--editor-cols)] overflow-hidden rounded-2xl border border-white/60 bg-white/60 shadow-2xl backdrop-blur-md max-lg:grid-cols-1 max-lg:grid-rows-[300px_1fr]"
          style={{
            '--editor-cols': editorMode === 'edit' ? '320px 1fr 320px' : '1fr 320px',
          }}
        >
          {editorMode === 'edit' ? <ObjectLibrary /> : null}
          <CanvasEditor />
          <InspectorPanel />
        </div>
      </main>
    </DndContext>
  )
}

export default App
