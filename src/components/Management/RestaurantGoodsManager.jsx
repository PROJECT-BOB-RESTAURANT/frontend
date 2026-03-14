import { useMemo, useState } from 'react'
import { useFloorStore } from '../../store/useFloorStore'

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
  const addWorker = useFloorStore((state) => state.addWorker)
  const updateWorker = useFloorStore((state) => state.updateWorker)
  const deleteWorker = useFloorStore((state) => state.deleteWorker)
  const updateOpeningHoursDay = useFloorStore((state) => state.updateOpeningHoursDay)

  const addMenuFolder = useFloorStore((state) => state.addMenuFolder)
  const renameMenuFolder = useFloorStore((state) => state.renameMenuFolder)
  const deleteMenuFolder = useFloorStore((state) => state.deleteMenuFolder)
  const addMenuItem = useFloorStore((state) => state.addMenuItem)
  const updateMenuItem = useFloorStore((state) => state.updateMenuItem)
  const deleteMenuItem = useFloorStore((state) => state.deleteMenuItem)

  const [newWorkerName, setNewWorkerName] = useState('')
  const [newWorkerRole, setNewWorkerRole] = useState('waiter')
  const [folderPath, setFolderPath] = useState([])
  const [newFolderName, setNewFolderName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')

  const workers = currentRestaurant?.workers ?? []
  const openingHours = currentRestaurant?.openingHours ?? []
  const rootFolders = currentRestaurant?.goodsCatalog ?? currentRestaurant?.goodsCategories ?? []
  const activeFolder = useMemo(
    () => findFolderByPath(rootFolders, folderPath),
    [rootFolders, folderPath],
  )
  const visibleFolders = activeFolder ? activeFolder.folders : rootFolders
  const visibleItems = activeFolder ? activeFolder.items : []

  return (
    <section className="mt-5 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-xl backdrop-blur">
      <div className="mb-3">
        <h2 className="text-base font-bold text-slate-800">Restaurant Management</h2>
        <p className="text-xs text-slate-500">
          Manage workers and a nested menu-folder catalog for this restaurant.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Workers</h3>

          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              type="text"
              placeholder="Worker name"
              value={newWorkerName}
              onChange={(event) => setNewWorkerName(event.target.value)}
            />
            <select
              className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              value={newWorkerRole}
              onChange={(event) => setNewWorkerRole(event.target.value)}
            >
              <option value="waiter">Waiter</option>
              <option value="manager">Manager</option>
              <option value="chef">Chef</option>
            </select>
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              onClick={() => {
                if (!newWorkerName.trim()) return
                addWorker(newWorkerName, newWorkerRole)
                setNewWorkerName('')
              }}
            >
              Add
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {workers.length > 0 ? (
              workers.map((worker) => (
                <div
                  key={worker.id}
                  className="grid grid-cols-[1fr_140px_auto] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
                >
                  <input
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                    type="text"
                    value={worker.name}
                    onChange={(event) => updateWorker(worker.id, { name: event.target.value })}
                  />
                  <select
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                    value={worker.role}
                    onChange={(event) => updateWorker(worker.id, { role: event.target.value })}
                  >
                    <option value="waiter">Waiter</option>
                    <option value="manager">Manager</option>
                    <option value="chef">Chef</option>
                  </select>
                  <button
                    type="button"
                    className="rounded-md bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-200"
                    onClick={() => deleteWorker(worker.id)}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No workers yet.</p>
            )}
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
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
          </div>
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
              onClick={() => {
                if (!newFolderName.trim()) return
                addMenuFolder(activeFolder?.id ?? null, newFolderName)
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
                    renameMenuFolder(folder.id, next)
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="rounded-md bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-200"
                  onClick={() => deleteMenuFolder(folder.id)}
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
                      value={item.name}
                      onChange={(event) =>
                        updateMenuItem(activeFolder.id, item.id, { name: event.target.value })
                      }
                    />
                    <input
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(event) =>
                        updateMenuItem(activeFolder.id, item.id, { price: Number(event.target.value) })
                      }
                    />
                    <button
                      type="button"
                      className="rounded-md bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-200"
                      onClick={() => deleteMenuItem(activeFolder.id, item.id)}
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
                    addMenuItem(activeFolder.id, newItemName, Number(newItemPrice || 0))
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
