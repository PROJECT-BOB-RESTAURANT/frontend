import { useState } from 'react'

const COLLAPSE_STORAGE_KEY = 'bob.ui.userStatusCollapsed'

const initialCollapsedState = () => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true'
}

function UserStatusBadge({ session, onLogout, onBackToAdmin }) {
  const [collapsed, setCollapsed] = useState(initialCollapsedState)

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next))
      }
      return next
    })
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur transition hover:bg-white"
        onClick={toggleCollapsed}
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
        {session.username}
      </button>
    )
  }

  return (
    <section className="fixed bottom-4 left-4 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">{session.username}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Signed in</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
          {session.role ?? 'UNKNOWN'}
        </span>
        {typeof onBackToAdmin === 'function' ? (
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={onBackToAdmin}
          >
            Admin
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
          onClick={toggleCollapsed}
        >
          Hide
        </button>
        <button
          type="button"
          className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-slate-700"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </section>
  )
}

export { UserStatusBadge }