import { countFolders, formatTodayOpeningHours } from '../utils/restaurantStats'

function RestaurantManagementPage({
  restaurants,
  isBackendLoading,
  onOpenGuestReservationPage,
  onCreateRestaurant,
  onOpenRestaurant,
  onRenameRestaurant,
  onDeleteRestaurant,
}) {
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
              onClick={onOpenGuestReservationPage}
            >
              Guest Reservation Page
            </button>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onCreateRestaurant}
              disabled={isBackendLoading}
            >
              Add New Restaurant
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {restaurants.length === 0 ? (
            <article className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 md:col-span-2">
              No restaurants found. Create your first restaurant with the "Add New Restaurant" button.
            </article>
          ) : null}
          {restaurants.map((restaurant) => (
            <article key={restaurant.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-base font-bold text-slate-800">{restaurant.name}</h2>
              <p className="mt-1 text-xs text-slate-500">Floors: {restaurant.floors.length}</p>
              <p className="text-xs text-slate-500">Workers: {restaurant.workers?.length ?? 0}</p>
              <p className="text-xs text-slate-500">
                Menu folders: {countFolders(restaurant.goodsCatalog ?? restaurant.goodsCategories ?? [])}
              </p>
              <p className="text-xs text-slate-500">{formatTodayOpeningHours(restaurant)}</p>
              <p className="text-xs text-slate-500">
                Updated: {new Date(restaurant.updatedAt).toLocaleString()}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="rounded-md bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500"
                  onClick={() => onOpenRestaurant(restaurant.id)}
                >
                  Open Floors
                </button>
                <button
                  type="button"
                  className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-400"
                  onClick={() => onRenameRestaurant(restaurant)}
                  disabled={isBackendLoading}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-500"
                  onClick={() => onDeleteRestaurant(restaurant.id)}
                  disabled={isBackendLoading}
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

export { RestaurantManagementPage }
