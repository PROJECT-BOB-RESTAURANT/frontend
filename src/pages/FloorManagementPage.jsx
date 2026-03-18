function FloorManagementPage({
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
  goodsManager,
}) {
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
              onClick={onBackToRestaurants}
            >
              Back To Restaurants
            </button>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onCreateFloor}
              disabled={isBackendLoading}
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
              <p className="text-xs text-slate-500">Updated: {new Date(floor.updatedAt).toLocaleString()}</p>

              <div className="mt-3 grid grid-cols-4 gap-2">
                <button
                  type="button"
                  className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  onClick={() => onOpenFloor(floor.id, 'view')}
                >
                  View
                </button>
                <button
                  type="button"
                  className="rounded-md bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500"
                  onClick={() => onOpenFloor(floor.id, 'edit')}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-400"
                  onClick={() => onRenameFloor(floor)}
                  disabled={isBackendLoading}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-500"
                  onClick={() => onDeleteFloor(floor.id)}
                  disabled={isBackendLoading}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>

        {goodsManager}
      </section>
    </main>
  )
}

export { FloorManagementPage }
