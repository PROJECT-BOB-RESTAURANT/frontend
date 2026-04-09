import { useEffect, useRef, useState } from 'react'

const COLLAPSE_STORAGE_KEY = 'bob.ui.userStatusCollapsed'
const POSITION_STORAGE_KEY = 'bob.ui.userStatusPosition'

const initialCollapsedState = () => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true'
}

const initialPositionState = () => {
  if (typeof window === 'undefined') {
    return { x: 16, y: null }
  }

  const raw = window.localStorage.getItem(POSITION_STORAGE_KEY)
  if (!raw) {
    return { x: 16, y: null }
  }

  try {
    const parsed = JSON.parse(raw)
    const x = Number(parsed?.x)
    const y = Number(parsed?.y)

    if (!Number.isFinite(x)) {
      return { x: 16, y: null }
    }

    return {
      x,
      y: Number.isFinite(y) ? y : null,
    }
  } catch {
    return { x: 16, y: null }
  }
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

function UserStatusBadge({ session, onLogout, onBackToAdmin }) {
  const [collapsed, setCollapsed] = useState(initialCollapsedState)
  const [position, setPosition] = useState(initialPositionState)
  const badgeRef = useRef(null)
  const positionRef = useRef(position)

  useEffect(() => {
    positionRef.current = position
  }, [position])

  const savePosition = (nextPosition) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(nextPosition))
    }
  }

  const clampPositionToViewport = (nextPosition, width, height) => {
    const minX = 8
    const minY = 8
    const maxX = Math.max(minX, window.innerWidth - width - 8)
    const maxY = Math.max(minY, window.innerHeight - height - 8)

    return {
      x: clamp(Number(nextPosition?.x ?? 16), minX, maxX),
      y:
        nextPosition?.y === null || nextPosition?.y === undefined
          ? null
          : clamp(Number(nextPosition.y), minY, maxY),
    }
  }

  const syncPositionToViewport = () => {
    if (typeof window === 'undefined') return
    if (!badgeRef.current) return

    const rect = badgeRef.current.getBoundingClientRect()
    const current = positionRef.current
    const next = clampPositionToViewport(current, rect.width, rect.height)

    if (next.x !== current.x || next.y !== current.y) {
      setPosition(next)
      savePosition(next)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const frame = window.requestAnimationFrame(syncPositionToViewport)
    const onResize = () => syncPositionToViewport()

    window.addEventListener('resize', onResize)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [collapsed])

  const moveByPointer = (event, anchorDx, anchorDy, width, height) => {
    const minX = 8
    const minY = 8
    const maxX = Math.max(minX, window.innerWidth - width - 8)
    const maxY = Math.max(minY, window.innerHeight - height - 8)

    const next = {
      x: clamp(event.clientX - anchorDx, minX, maxX),
      y: clamp(event.clientY - anchorDy, minY, maxY),
    }

    setPosition(next)
    savePosition(next)
  }

  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return

    const target = event.target
    if (target instanceof HTMLElement && target.closest('[data-user-badge-action="true"]')) {
      return
    }

    const element = event.currentTarget
    const rect = element.getBoundingClientRect()
    const anchorDx = event.clientX - rect.left
    const anchorDy = event.clientY - rect.top

    const onMove = (moveEvent) => {
      moveByPointer(moveEvent, anchorDx, anchorDy, rect.width, rect.height)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const positionStyle = {
    left: `${position.x}px`,
    top: position.y === null ? undefined : `${position.y}px`,
    bottom: position.y === null ? '16px' : undefined,
  }

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
        ref={badgeRef}
        type="button"
        className="fixed z-30 flex touch-none items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur transition hover:bg-white"
        style={positionStyle}
        onClick={toggleCollapsed}
        onPointerDown={onPointerDown}
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
        {session.username}
      </button>
    )
  }

  return (
    <section
      ref={badgeRef}
      className="fixed z-30 flex max-w-[calc(100vw-1rem)] touch-none items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
      style={positionStyle}
      onPointerDown={onPointerDown}
    >
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
            data-user-badge-action="true"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={onBackToAdmin}
          >
            Admin
          </button>
        ) : null}
        <button
          type="button"
          data-user-badge-action="true"
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
          onClick={toggleCollapsed}
        >
          Hide
        </button>
        <button
          type="button"
          data-user-badge-action="true"
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