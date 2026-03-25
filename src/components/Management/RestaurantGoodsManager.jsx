import { useMemo, useState } from 'react'
import { useFloorStore } from '../../store/useFloorStore'
import { backendApi } from '../../services/backendApi'

const findFolderByPath = (folders, pathIds) => {
  let currentFolders = folders
  let current = null

  for (const id of pathIds) {
    current = currentFolders.find((folder) => folder.id === id) ?? null
    if (!current) return null
    currentFolders = current.folders
  }

  return current
}

export const RestaurantGoodsManager = () => {
  const currentRestaurant = useFloorStore((state) =>
    state.restaurants.find((restaurant) => restaurant.id === state.currentRestaurantId) ?? null,
  )
  const currentRestaurantId = useFloorStore((state) => state.currentRestaurantId)
  const currentFloorId = useFloorStore((state) => state.currentFloorId)
  const page = useFloorStore((state) => state.page)
  const editorMode = useFloorStore((state) => state.editorMode)
  const waiterTableId = useFloorStore((state) => state.waiterTableId)
  const waiterWorkerId = useFloorStore((state) => state.waiterWorkerId)
  const selectedObjectId = useFloorStore((state) => state.selectedObjectId)
  const hydrateFromBackend = useFloorStore((state) => state.hydrateFromBackend)
  const updateOpeningHoursDay = useFloorStore((state) => state.updateOpeningHoursDay)

  const [folderPath, setFolderPath] = useState([])
  const [newFolderName, setNewFolderName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const openingHours = currentRestaurant?.openingHours ?? []
  const rootFolders = currentRestaurant?.goodsCatalog ?? currentRestaurant?.goodsCategories ?? []
  const activeFolder = useMemo(
    () => findFolderByPath(rootFolders, folderPath),
    [rootFolders, folderPath],
  )
  const visibleFolders = activeFolder ? activeFolder.folders : rootFolders
  const visibleItems = activeFolder ? activeFolder.items : []

  const reloadFromBackend = async (message) => {
    const graph = await backendApi.fetchRestaurantsGraph()
    hydrateFromBackend(graph, {
      currentRestaurantId,
      currentFloorId,
      page,
      editorMode,
      waiterTableId,
      waiterWorkerId,
      selectedObjectId,
    })
    if (message) {
      setFeedback(message)
    }
  }

  const runMutation = async (operation, successMessage) => {
    setIsSaving(true)
    try {
      await operation()
      await reloadFromBackend(successMessage)
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-xl backdrop-blur">
      <div className="mb-3">
        <h2 className="text-base font-bold text-slate-800">Restaurant Management</h2>
        <p className="text-xs text-slate-500">
          Manage opening hours and a nested menu-folder catalog for this restaurant.
        </p>
        {feedback ? <p className="mt-2 text-xs text-slate-600">{feedback}</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Opening Hours
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Set opening/closing times per day or mark day as closed.
          </p>

          <div className="mt-3 space-y-2">
            {openingHours.map((entry) => (
              <div
                key={entry.day}
                className="grid grid-cols-[110px_1fr_1fr_auto] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
              >
                <span className="text-xs font-semibold text-slate-700">{entry.day}</span>
                <input
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                  type="time"
                  value={entry.open}
                  disabled={entry.isClosed}
                  onChange={(event) =>
                    updateOpeningHoursDay(entry.day, { open: event.target.value })
                  }
                />
                <input
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                  type="time"
                  value={entry.close}
                  disabled={entry.isClosed}
                  onChange={(event) =>
                    updateOpeningHoursDay(entry.day, { close: event.target.value })
                  }
                />
                <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={entry.isClosed}
                    onChange={(event) =>
                      updateOpeningHoursDay(entry.day, { isClosed: event.target.checked })
                    }
                  />
                  Closed
                </label>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="mt-3 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            onClick={() =>
              runMutation(
                () => backendApi.upsertWeeklyOpeningHours(currentRestaurantId, openingHours),
                'Opening hours saved.',
              )
            }
          >
            {isSaving ? 'Saving...' : 'Save Opening Hours'}
          </button>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Menu Folders</h3>
            {folderPath.length > 0 ? (
              <button
                type="button"
                className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                onClick={() => setFolderPath((prev) => prev.slice(0, -1))}
              >
                Back
              </button>
            ) : null}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Location: {activeFolder ? activeFolder.name : 'Root'}
          </p>

          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              type="text"
              placeholder="New folder name"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
            />
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              disabled={isSaving}
              onClick={() => {
                if (!newFolderName.trim()) return
                runMutation(
                  () =>
                    backendApi.createMenuFolder(currentRestaurantId, {
                      parentFolderId: activeFolder?.id ?? null,
                      name: newFolderName,
                    }),
                  'Menu folder created.',
                )
                setNewFolderName('')
              }}
            >
              Add Folder
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {visibleFolders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
              >
                <button
                  type="button"
                  className="rounded-md bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-500"
                  onClick={() => setFolderPath((prev) => [...prev, folder.id])}
                >
                  Open
                </button>
                <span className="text-sm font-medium text-slate-700">{folder.name}</span>
                <button
                  type="button"
                  className="ml-auto rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                  onClick={() => {
                    const next = window.prompt('Rename folder', folder.name)
                    if (!next) return
                    runMutation(
                      () =>
                        backendApi.updateMenuFolder(currentRestaurantId, folder.id, {
                          name: next,
                        }),
                      'Menu folder renamed.',
                    )
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="rounded-md bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-200"
                  onClick={() =>
                    runMutation(
                      () => backendApi.deleteMenuFolder(currentRestaurantId, folder.id),
                      'Menu folder deleted.',
                    )
                  }
                >
                  Delete
                </button>
              </div>
            ))}

            {visibleFolders.length === 0 ? (
              <p className="text-xs text-slate-500">No subfolders in this level.</p>
            ) : null}
          </div>

          {activeFolder ? (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Items In {activeFolder.name}
              </h4>

              <div className="mt-2 space-y-2">
                {visibleItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_120px_auto] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
                  >
                    <input
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                      type="text"
                      defaultValue={item.name}
                      onBlur={(event) =>
                        runMutation(
                          () =>
                            backendApi.updateMenuItem(currentRestaurantId, activeFolder.id, item.id, {
                              name: event.target.value,
                            }),
                          'Menu item updated.',
                        )
                      }
                    />
                    <input
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={item.price}
                      onBlur={(event) =>
                        runMutation(
                          () =>
                            backendApi.updateMenuItem(currentRestaurantId, activeFolder.id, item.id, {
                              price: Number(event.target.value),
                            }),
                          'Menu item updated.',
                        )
                      }
                    />
                    <button
                      type="button"
                      className="rounded-md bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-200"
                      onClick={() =>
                        runMutation(
                          () =>
                            backendApi.deleteMenuItem(currentRestaurantId, activeFolder.id, item.id),
                          'Menu item removed.',
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-[1fr_120px_auto] gap-2">
                <input
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                  type="text"
                  placeholder="Item name"
                  value={newItemName}
                  onChange={(event) => setNewItemName(event.target.value)}
                />
                <input
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  value={newItemPrice}
                  onChange={(event) => setNewItemPrice(event.target.value)}
                />
                <button
                  type="button"
                  className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                  onClick={() => {
                    if (!newItemName.trim()) return
                    runMutation(
                      () =>
                        backendApi.createMenuItem(currentRestaurantId, {
                          folderId: activeFolder.id,
                          name: newItemName,
                          price: Number(newItemPrice || 0),
                        }),
                      'Menu item added.',
                    )
                    setNewItemName('')
                    setNewItemPrice('')
                  }}
                >
                  Add Item
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">
              Open a folder to add priced items or create nested subfolders.
            </p>
          )}
        </article>
      </div>
    </section>
  )
}
