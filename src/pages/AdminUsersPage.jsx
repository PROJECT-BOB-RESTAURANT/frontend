import { useState } from 'react'
import { backendApi } from '../services/backendApi'

const roles = ['ADMIN', 'MANAGER', 'STAFF']

function AdminUsersPage({ onBack }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('STAFF')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const submit = async (event) => {
    event.preventDefault()

    const normalizedUsername = username.trim()
    if (!normalizedUsername || !password) {
      setFeedback('Username and password are required.')
      return
    }

    setIsSubmitting(true)
    setFeedback('')

    try {
      await backendApi.register({
        username: normalizedUsername,
        password,
        role,
      })
      setFeedback(`User ${normalizedUsername} created.`)
      setUsername('')
      setPassword('')
      setRole('STAFF')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-full place-items-center bg-slate-100 p-6">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

        <form className="grid gap-3" onSubmit={submit}>
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

          {feedback ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{feedback}</p>
          ) : null}

          <button
            type="submit"
            className="mt-1 h-10 rounded-lg bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </section>
    </main>
  )
}

export { AdminUsersPage }
