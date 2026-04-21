import { useRef, useState } from 'react'

function FloorManagementPage({
  role,
  currentRestaurant,
  currentRestaurantId,
  restaurants,
  floors,
  isBackendLoading,
  onBackToRestaurants,
  onCreateFloor,
  onSwitchRestaurant,
  onOpenFloor,
  onRenameFloor,
  onDeleteFloor,
  onOpenWorkers,
  onRenameRestaurant,
  onDeleteRestaurant,
  onOpenKitchenMenu,
  onOpenReservationStatistics,
  onOpenGuestReservationPage,
  onExportFloorPlanJson,
  onImportFloorPlanJson,
  goodsManager,
}) {
  const isStaff = role === 'STAFF'
  const isAdmin = role === 'ADMIN'
  const currentRestaurantName = currentRestaurant?.name ?? 'Restaurant'
  const floorPlanFileRef = useRef(null)
  const [floorPlanJsonText, setFloorPlanJsonText] = useState('')
  const [floorPlanFeedback, setFloorPlanFeedback] = useState('')

  const downloadFloorPlanJson = () => {
    if (!currentRestaurantId || typeof onExportFloorPlanJson !== 'function') {
      setFloorPlanFeedback('No restaurant selected.')
      return
    }

    const data = onExportFloorPlanJson(currentRestaurantId)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `floor-plan-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setFloorPlanFeedback('Exported floor plan JSON file.')
  }

  const importFloorPlanJson = async () => {
    if (!currentRestaurantId || typeof onImportFloorPlanJson !== 'function') {
      setFloorPlanFeedback('No restaurant selected.')
      return
    }

    try {
      await onImportFloorPlanJson(floorPlanJsonText, currentRestaurantId)
      setFloorPlanFeedback('Imported floor plan JSON.')
    } catch (error) {
      setFloorPlanFeedback(error.message)
    }
  }

  const onSelectFloorPlanFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      setFloorPlanJsonText(text)
      setFloorPlanFeedback(`Loaded ${file.name}.`)
    } catch (error) {
      setFloorPlanFeedback(error.message)
    } finally {
      event.target.value = ''
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-6">
      <section className="mx-auto max-w-5xl rounded-2xl border border-white/70 bg-white/75 p-6 shadow-2xl backdrop-blur">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">
              {currentRestaurantName} Management
            </h1>
            <p className="text-sm text-slate-500">Use dedicated sections to manage restaurant settings, floors, and staff.</p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            onClick={onBackToRestaurants}
          >
            Back To Restaurants
          </button>
        </div>

        <div className="mb-4 max-w-sm">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Restaurant
          </label>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={currentRestaurantId ?? ''}
            onChange={(event) => onSwitchRestaurant(event.target.value)}
          >
            {restaurants.length === 0 ? <option value="">No restaurants</option> : null}
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </div>

        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Management Menu</h2>
          <p className="mt-1 text-xs text-slate-500">Use separated button groups for restaurant operations and staff operations.</p>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Restaurant Manager Buttons</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {typeof onOpenKitchenMenu === 'function' ? (
                  <button
                    type="button"
                    className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                    onClick={() => onOpenKitchenMenu(currentRestaurantId)}
                    disabled={!currentRestaurantId}
                  >
                    Open Kitchen
                  </button>
                ) : null}
                {typeof onOpenReservationStatistics === 'function' ? (
                  <button
                    type="button"
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                    onClick={() => onOpenReservationStatistics(currentRestaurantId)}
                    disabled={!currentRestaurantId}
                  >
                    Reservation Stats
                  </button>
                ) : null}
                {typeof onOpenGuestReservationPage === 'function' && !isStaff ? (
                  <button
                    type="button"
                    className="rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
                    onClick={onOpenGuestReservationPage}
                  >
                    Guest Reservation Page
                  </button>
                ) : null}
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Staff Managing Buttons</h3>
              <div className="mt-2 grid gap-2">
                {!isStaff ? (
                  <button
                    type="button"
                    className="rounded-md bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-200"
                    onClick={onOpenWorkers}
                  >
                    Manage Workers
                  </button>
                ) : (
                  <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                    Workers can be managed by managers and admins.
                  </p>
                )}
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-slate-50 p-3 lg:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Buttons</h3>
              {!isStaff ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onRenameRestaurant(currentRestaurant)}
                    disabled={isBackendLoading || !currentRestaurant}
                  >
                    Rename Restaurant
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onDeleteRestaurant(currentRestaurantId)}
                    disabled={isBackendLoading || !currentRestaurantId}
                  >
                    Delete Restaurant
                  </button>
                </div>
              ) : (
                <p className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                  Admin actions are available for managers and admins.
                </p>
              )}
            </article>
          </div>
        </section>

        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Floor Manager</h2>
          <p className="mt-1 text-xs text-slate-500">Create floors, open floor view/editor, and manage menu and reservations setup.</p>
          {!isStaff ? (
            <div className="mt-3">
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onCreateFloor}
                disabled={isBackendLoading}
              >
                Add New Floor
              </button>
            </div>
          ) : null}

          {isAdmin ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Floor Plan JSON
              </h3>

              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                  onClick={downloadFloorPlanJson}
                  disabled={!currentRestaurantId}
                >
                  Export Floor Plan
                </button>
                <button
                  type="button"
                  className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  onClick={() => floorPlanFileRef.current?.click()}
                >
                  Load JSON File
                </button>
                <button
                  type="button"
                  className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                  onClick={importFloorPlanJson}
                  disabled={!floorPlanJsonText.trim() || !currentRestaurantId}
                >
                  Import Floor Plan
                </button>
              </div>

              <input
                ref={floorPlanFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onSelectFloorPlanFile}
              />

              <textarea
                className="mt-2 h-28 w-full rounded-md border border-slate-200 p-2 text-xs"
                placeholder="Paste floor plan JSON here..."
                value={floorPlanJsonText}
                onChange={(event) => setFloorPlanJsonText(event.target.value)}
              />

              {floorPlanFeedback ? (
                <p className="mt-1 text-[11px] text-slate-500">{floorPlanFeedback}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {floors.map((floor) => (
              <article key={floor.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-bold text-slate-800">{floor.name}</h3>
                <p className="mt-1 text-xs text-slate-500">Objects: {floor.objects.length}</p>
                {floor.size?.width && floor.size?.height ? (
                  <p className="text-xs text-slate-500">
                    Size: {floor.size.width} x {floor.size.height}
                  </p>
                ) : null}
                <p className="text-xs text-slate-500">Updated: {new Date(floor.updatedAt).toLocaleString()}</p>

                <div className={`mt-3 grid gap-2 ${isStaff ? 'grid-cols-1' : 'grid-cols-4'}`}>
                  <button
                    type="button"
                    className="rounded-md bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500"
                    onClick={() => onOpenFloor(floor.id, 'view')}
                  >
                    View
                  </button>
                  {!isStaff ? (
                    <button
                      type="button"
                      className="rounded-md bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500"
                      onClick={() => onOpenFloor(floor.id, 'edit')}
                    >
                      Edit
                    </button>
                  ) : null}
                  {!isStaff ? (
                    <button
                      type="button"
                      className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-400"
                      onClick={() => onRenameFloor(floor)}
                      disabled={isBackendLoading}
                    >
                      Rename
                    </button>
                  ) : null}
                  {!isStaff ? (
                    <button
                      type="button"
                      className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-500"
                      onClick={() => onDeleteFloor(floor.id)}
                      disabled={isBackendLoading}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {!isStaff ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Menu And Reservations Setup</h3>
              {goodsManager}
            </div>
          ) : null}
        </section>

      </section>
    </main>
  )
}

export { FloorManagementPage }
