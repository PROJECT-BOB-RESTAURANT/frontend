function AdminHomePage({ onManageUsers, onManageRestaurants }) {
  return (
    <main className="grid min-h-full place-items-center bg-slate-100 p-6">
      <section className="w-full max-w-4xl">
        <header className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Control</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Choose Management Area</h1>
          <p className="mt-2 text-sm text-slate-600">Select where you want to continue before opening restaurant operations.</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            onClick={onManageUsers}
          >
            <p className="text-lg font-bold text-slate-900">Manage Users</p>
            <p className="mt-2 text-sm text-slate-600">Create new application users and assign their access role.</p>
          </button>

          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            onClick={onManageRestaurants}
          >
            <p className="text-lg font-bold text-slate-900">Manage Restaurants</p>
            <p className="mt-2 text-sm text-slate-600">Open restaurant list, floor management, editor, waiter, and guest flows.</p>
          </button>
        </div>
      </section>
    </main>
  )
}

export { AdminHomePage }
