import { useRef, useState } from 'react'
import { countFolders, formatTodayOpeningHours } from '../utils/restaurantStats'

function RestaurantManagementPage({
  role,
  restaurants,
  isBackendLoading,
  onCreateRestaurant,
  onOpenRestaurant,
  onExportRestaurantJson,
  onImportRestaurantJson,
}) {
  const isStaff = role === 'STAFF'
  const isAdmin = role === 'ADMIN'
  const jsonFileRef = useRef(null)
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [restaurantJsonText, setRestaurantJsonText] = useState('')
  const [restaurantJsonFeedback, setRestaurantJsonFeedback] = useState('')

  const effectiveSelectedRestaurantId = restaurants.some(
    (restaurant) => restaurant.id === selectedRestaurantId,
  )
    ? selectedRestaurantId
    : (restaurants[0]?.id ?? '')

  const downloadRestaurantJson = () => {
    if (!effectiveSelectedRestaurantId || typeof onExportRestaurantJson !== 'function') {
      setRestaurantJsonFeedback('Choose a restaurant first.')
      return
    }

    const data = onExportRestaurantJson(effectiveSelectedRestaurantId)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `restaurant-${effectiveSelectedRestaurantId}-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setRestaurantJsonFeedback('Exported full restaurant JSON file.')
  }

  const importRestaurantJson = () => {
    if (!effectiveSelectedRestaurantId || typeof onImportRestaurantJson !== 'function') {
      setRestaurantJsonFeedback('Choose a restaurant first.')
      return
    }

    try {
      onImportRestaurantJson(restaurantJsonText, effectiveSelectedRestaurantId)
      setRestaurantJsonFeedback('Imported full restaurant JSON.')
    } catch (error) {
      setRestaurantJsonFeedback(error.message)
    }
  }

  const onSelectJsonFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      setRestaurantJsonText(text)
      setRestaurantJsonFeedback(`Loaded ${file.name}.`)
    } catch (error) {
      setRestaurantJsonFeedback(error.message)
    } finally {
      event.target.value = ''
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-6">
      <section className="mx-auto max-w-5xl rounded-2xl border border-white/70 bg-white/75 p-6 shadow-2xl backdrop-blur">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Restaurants</h1>
            <p className="text-sm text-slate-500">Choose a restaurant and continue through one focused management menu.</p>
          </div>
          {!isStaff ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onCreateRestaurant}
                disabled={isBackendLoading}
              >
                Add New Restaurant
              </button>
            </div>
          ) : null}
        </div>

        {isAdmin ? (
          <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Restaurant JSON
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Export or import the full restaurant package (restaurant details and floors).
            </p>

            <div className="mt-2 max-w-sm">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Target Restaurant
              </label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={effectiveSelectedRestaurantId}
                onChange={(event) => setSelectedRestaurantId(event.target.value)}
              >
                {restaurants.length === 0 ? <option value="">No restaurants</option> : null}
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={downloadRestaurantJson}
                disabled={!effectiveSelectedRestaurantId}
              >
                Export Restaurant
              </button>
              <button
                type="button"
                className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                onClick={() => jsonFileRef.current?.click()}
              >
                Load JSON File
              </button>
              <button
                type="button"
                className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={importRestaurantJson}
                disabled={!effectiveSelectedRestaurantId || !restaurantJsonText.trim()}
              >
                Import Restaurant
              </button>
            </div>

            <input
              ref={jsonFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onSelectJsonFile}
            />

            <textarea
              className="mt-2 h-28 w-full rounded-md border border-slate-200 p-2 text-xs"
              placeholder="Paste full restaurant JSON here..."
              value={restaurantJsonText}
              onChange={(event) => setRestaurantJsonText(event.target.value)}
            />

            {restaurantJsonFeedback ? (
              <p className="mt-1 text-[11px] text-slate-500">{restaurantJsonFeedback}</p>
            ) : null}
          </section>
        ) : null}

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

              <div className="mt-3 grid gap-2 grid-cols-1">
                <button
                  type="button"
                  className="rounded-md bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500"
                  onClick={() => onOpenRestaurant(restaurant.id)}
                >
                  Manage Restaurant
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
