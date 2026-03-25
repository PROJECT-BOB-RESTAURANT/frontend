import { useEffect, useMemo, useState } from 'react'
import { backendApi } from '../services/backendApi'

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
]

function WorkersManagementPage({
  currentRestaurant,
  currentRestaurantId,
  restaurants,
  onSwitchRestaurant,
  onBack,
  onReload,
}) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [selectedRoles, setSelectedRoles] = useState({})

  const workers = currentRestaurant?.workers ?? []

  const workerUserIds = useMemo(
    () => new Set(workers.map((worker) => String(worker.userId ?? ''))),
    [workers],
  )

  const availableUsers = useMemo(
    () => users.filter((user) => !workerUserIds.has(String(user.id))),
    [users, workerUserIds],
  )

  const loadUsers = async (search = '') => {
    setLoadingUsers(true)
    setFeedback('')
    try {
      const result = await backendApi.listUsers(search)
      setUsers(Array.isArray(result) ? result : [])
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    loadUsers('')
  }, [currentRestaurantId])

  const roleForUser = (userId) => selectedRoles[userId] ?? 'staff'

  const assignUser = async (user) => {
    setIsSaving(true)
    setFeedback('')

    try {
      await backendApi.createWorker(currentRestaurantId, {
        userId: user.id,
        name: user.username,
        role: roleForUser(user.id),
      })
      await onReload('Worker added from user list.')
      await loadUsers(query)
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const updateWorkerRole = async (workerId, role) => {
    setIsSaving(true)
    setFeedback('')

    try {
      await backendApi.updateWorker(currentRestaurantId, workerId, { role })
      await onReload('Worker role updated.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const removeWorker = async (workerId) => {
    setIsSaving(true)
    setFeedback('')

    try {
      await backendApi.deleteWorker(currentRestaurantId, workerId)
      await onReload('Worker removed.')
      await loadUsers(query)
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-100 p-6">
      <section className="mx-auto max-w-5xl rounded-2xl border border-white/70 bg-white/75 p-6 shadow-2xl backdrop-blur">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Restaurant Workers</h1>
            <p className="text-sm text-slate-500">Select users from the system list and assign them as workers.</p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            onClick={onBack}
          >
            Back To Floors
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

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Available Users</h2>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                loadUsers(query)
              }}
            >
              <input
                className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
                type="text"
                placeholder="Search by username"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                disabled={loadingUsers}
              >
                {loadingUsers ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="mt-3 space-y-2">
              {availableUsers.map((user) => (
                <div
                  key={user.id}
                  className="grid grid-cols-[1fr_120px_auto] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{user.username}</p>
                    <p className="text-[11px] text-slate-500">User role: {user.role}</p>
                  </div>
                  <select
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                    value={roleForUser(user.id)}
                    onChange={(event) =>
                      setSelectedRoles((previous) => ({
                        ...previous,
                        [user.id]: event.target.value,
                      }))
                    }
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => assignUser(user)}
                    disabled={isSaving}
                  >
                    Add
                  </button>
                </div>
              ))}

              {!loadingUsers && availableUsers.length === 0 ? (
                <p className="text-xs text-slate-500">No available users for this search.</p>
              ) : null}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Assigned Workers</h2>

            <div className="mt-3 space-y-2">
              {workers.map((worker) => (
                <div
                  key={worker.id}
                  className="grid grid-cols-[1fr_120px_auto] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{worker.name}</p>
                  </div>
                  <select
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                    value={worker.role}
                    onChange={(event) => updateWorkerRole(worker.id, event.target.value)}
                    disabled={isSaving}
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-md bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => removeWorker(worker.id)}
                    disabled={isSaving}
                  >
                    Remove
                  </button>
                </div>
              ))}

              {workers.length === 0 ? <p className="text-xs text-slate-500">No workers assigned.</p> : null}
            </div>
          </article>
        </div>

        {feedback ? (
          <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{feedback}</p>
        ) : null}
      </section>
    </main>
  )
}

export { WorkersManagementPage }
