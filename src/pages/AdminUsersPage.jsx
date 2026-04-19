import { useEffect, useState } from 'react'
import { backendApi } from '../services/backendApi'

const roles = ['ADMIN', 'MANAGER', 'STAFF']

function AdminUsersPage({ onBack }) {
  const session = backendApi.getAuthSession()
  const currentUserId = session?.userId ? String(session.userId) : null
  const currentUsername = String(session?.username ?? '').trim()
  const [actualName, setActualName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('STAFF')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingActualName, setEditingActualName] = useState('')
  const [editingUsername, setEditingUsername] = useState('')
  const [editingRole, setEditingRole] = useState('STAFF')
  const [feedback, setFeedback] = useState('')

  const loadUsers = async (query = '') => {
    setIsLoadingUsers(true)
    try {
      const result = await backendApi.listUsers(query)
      setUsers(Array.isArray(result) ? result : [])
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsLoadingUsers(false)
    }
  }

  useEffect(() => {
    loadUsers('')
  }, [])

  const submit = async (event) => {
    event.preventDefault()

    const normalizedActualName = actualName.trim()
    const normalizedUsername = username.trim()
    if (!normalizedActualName || !normalizedUsername || !password) {
      setFeedback('Actual name, username, and password are required.')
      return
    }

    setIsSubmitting(true)
    setFeedback('')

    try {
      await backendApi.register({
        name: normalizedActualName,
        username: normalizedUsername,
        password,
        role,
      })
      setFeedback(`User ${normalizedUsername} created.`)
      setActualName('')
      setUsername('')
      setPassword('')
      setRole('STAFF')
      await loadUsers(search)
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEdit = (user) => {
    setEditingUserId(user.id)
    setEditingActualName(user.name ?? '')
    setEditingUsername(user.username)
    setEditingRole(user.role)
    setFeedback('')
  }

  const cancelEdit = () => {
    setEditingUserId(null)
    setEditingActualName('')
    setEditingUsername('')
    setEditingRole('STAFF')
  }

  const saveEdit = async () => {
    if (!editingUserId) return

    const normalizedActualName = editingActualName.trim()
    const normalizedUsername = editingUsername.trim()
    if (!normalizedActualName || !normalizedUsername) {
      setFeedback('Actual name and username are required.')
      return
    }

    setIsMutating(true)
    setFeedback('')

    try {
      await backendApi.updateUser(editingUserId, {
        name: normalizedActualName,
        username: normalizedUsername,
        role: editingRole,
      })
      setFeedback(`User ${normalizedUsername} updated.`)
      cancelEdit()
      await loadUsers(search)
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsMutating(false)
    }
  }

  const removeUser = async (user) => {
    const isCurrentUserById = currentUserId && String(user.id) === currentUserId
    const isCurrentUserByUsername =
      !currentUserId &&
      currentUsername &&
      String(user.username ?? '').trim().toLowerCase() === currentUsername.toLowerCase()

    if (isCurrentUserById || isCurrentUserByUsername) {
      setFeedback('You cannot delete your own account while logged in.')
      return
    }

    const shouldDelete = window.confirm(`Delete user ${user.username}?`)
    if (!shouldDelete) return

    setIsMutating(true)
    setFeedback('')

    try {
      await backendApi.deleteUser(user.id)
      setFeedback(`User ${user.username} deleted.`)
      if (editingUserId === user.id) {
        cancelEdit()
      }
      await loadUsers(search)
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <main className="grid min-h-full place-items-center bg-slate-100 p-6">
      <section className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Control</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Manage Users</h1>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={onBack}
          >
            Back
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Create User</h2>

            <form className="mt-3 grid gap-3" onSubmit={submit}>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700" htmlFor="admin-user-name">
                Actual Name
                <input
                  id="admin-user-name"
                  className="h-10 rounded-lg border border-slate-300 px-3 outline-none ring-orange-200 transition focus:border-orange-500 focus:ring-2"
                  value={actualName}
                  onChange={(event) => setActualName(event.target.value)}
                  maxLength={160}
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-slate-700" htmlFor="admin-user-username">
                Username
                <input
                  id="admin-user-username"
                  className="h-10 rounded-lg border border-slate-300 px-3 outline-none ring-orange-200 transition focus:border-orange-500 focus:ring-2"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  maxLength={120}
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-slate-700" htmlFor="admin-user-password">
                Password
                <input
                  id="admin-user-password"
                  type="password"
                  className="h-10 rounded-lg border border-slate-300 px-3 outline-none ring-orange-200 transition focus:border-orange-500 focus:ring-2"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  maxLength={255}
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-slate-700" htmlFor="admin-user-role">
                Role
                <select
                  id="admin-user-role"
                  className="h-10 rounded-lg border border-slate-300 px-3 outline-none ring-orange-200 transition focus:border-orange-500 focus:ring-2"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  disabled={isSubmitting}
                >
                  {roles.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="mt-1 h-10 rounded-lg bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Users</h2>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                loadUsers(search)
              }}
            >
              <input
                className="h-10 flex-1 rounded-lg border border-slate-300 px-3 outline-none ring-orange-200 transition focus:border-orange-500 focus:ring-2"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users"
              />
              <button
                type="submit"
                className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoadingUsers}
              >
                {isLoadingUsers ? 'Loading...' : 'Search'}
              </button>
            </form>

            <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {users.map((user) => {
                const isEditing = editingUserId === user.id
                const isCurrentUserById = currentUserId && String(user.id) === currentUserId
                const isCurrentUserByUsername =
                  !currentUserId &&
                  currentUsername &&
                  String(user.username ?? '').trim().toLowerCase() === currentUsername.toLowerCase()
                const isCurrentUser = Boolean(isCurrentUserById || isCurrentUserByUsername)
                return (
                  <div
                    key={user.id}
                    className="rounded-lg border border-slate-200 bg-white p-3"
                  >
                    {isEditing ? (
                      <div className="grid gap-2">
                        <input
                          className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                          value={editingActualName}
                          onChange={(event) => setEditingActualName(event.target.value)}
                          disabled={isMutating}
                          placeholder="Actual name"
                        />
                        <input
                          className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                          value={editingUsername}
                          onChange={(event) => setEditingUsername(event.target.value)}
                          disabled={isMutating}
                          placeholder="Username"
                        />
                        <select
                          className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                          value={editingRole}
                          onChange={(event) => setEditingRole(event.target.value)}
                          disabled={isMutating}
                        >
                          {roles.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="h-9 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={saveEdit}
                            disabled={isMutating}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={cancelEdit}
                            disabled={isMutating}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{user.name || 'Unnamed user'}</p>
                          <p className="text-sm font-semibold text-slate-800">{user.username}</p>
                          <p className="text-[11px] text-slate-500">Role: {user.role}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() => startEdit(user)}
                            disabled={isMutating}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="h-8 rounded-md bg-rose-600 px-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => removeUser(user)}
                            disabled={isMutating || isCurrentUser}
                            title={isCurrentUser ? 'You cannot delete your own account.' : 'Delete user'}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {!isLoadingUsers && users.length === 0 ? (
                <p className="text-xs text-slate-500">No users found.</p>
              ) : null}
            </div>
          </article>
        </div>

        {feedback ? (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{feedback}</p>
        ) : null}
      </section>
    </main>
  )
}

export { AdminUsersPage }
