import { useState } from 'react'
import { backendApi } from '../services/backendApi'

function LoginPage({ onAuthenticated }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
      const tokenResponse = await backendApi.login({
        username: normalizedUsername,
        password,
      })

      const session = backendApi.setAuthSession({
        token: tokenResponse?.token,
        tokenType: tokenResponse?.tokenType ?? 'Bearer',
        expiresAt: tokenResponse?.expiresAt ?? null,
        userId: tokenResponse?.userId ?? null,
        username: tokenResponse?.username ?? normalizedUsername,
        role: tokenResponse?.role ?? null,
      })

      onAuthenticated(session)
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative grid min-h-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_15%_10%,#fef08a_0,transparent_35%),radial-gradient(circle_at_88%_22%,#fdba74_0,transparent_30%),radial-gradient(circle_at_50%_90%,#67e8f9_0,transparent_35%),linear-gradient(135deg,#0f172a_0%,#1e293b_45%,#0b1120_100%)] p-6">
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:34px_34px] [mask-image:radial-gradient(circle_at_center,black_35%,transparent_85%)]"
        aria-hidden="true"
      />
      <section
        className="relative w-full max-w-[460px] rounded-[26px] border border-slate-400/40 bg-white/95 p-8 shadow-[0_20px_60px_rgba(2,6,23,0.4),inset_0_1px_0_rgba(255,255,255,0.9)] max-[560px]:rounded-[20px] max-[560px]:p-6"
        aria-live="polite"
      >
        <header className="mb-6">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-orange-800">BOB Restaurant Platform</p>
          <h1 className="mb-2 mt-2 text-[34px] leading-[1.05] font-bold text-slate-900 max-[560px]:text-[28px]">Welcome Back</h1>
          <p className="m-0 leading-relaxed text-slate-700">Use your account credentials to access restaurant operations.</p>
        </header>

        <form className="grid gap-3.5" onSubmit={submit}>
          <label className="grid gap-2 font-semibold text-slate-800" htmlFor="username">
            Username
            <input
              id="username"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-orange-600 focus:ring-3 focus:ring-orange-500/20"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              disabled={isSubmitting}
              maxLength={120}
              required
            />
          </label>

          <label className="grid gap-2 font-semibold text-slate-800" htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-orange-600 focus:ring-3 focus:ring-orange-500/20"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={isSubmitting}
              minLength={6}
              maxLength={255}
              required
            />
          </label>

          {feedback ? (
            <p className="m-0 rounded-xl border border-rose-200 bg-rose-100 px-3 py-2.5 text-sm text-rose-800">
              {feedback}
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-2 h-11 cursor-pointer rounded-xl border-0 bg-gradient-to-r from-orange-600 to-orange-500 font-bold text-white transition hover:-translate-y-px hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Please wait...' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  )
}

export { LoginPage }