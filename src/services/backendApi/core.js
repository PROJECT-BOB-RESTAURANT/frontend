const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')
const AUTH_STORAGE_KEY = 'bob.auth.session'

const extractEnvelopeData = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data
  return payload
}

const extractErrorMessage = (payload, fallback) => {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (typeof payload?.error?.message === 'string' && payload.error.message) return payload.error.message
  if (typeof payload?.error?.code === 'string' && payload.error.code) return payload.error.code
  if (typeof payload?.message === 'string' && payload.message) return payload.message
  if (typeof payload?.error === 'string' && payload.error) return payload.error
  if (typeof payload?.detail === 'string' && payload.detail) return payload.detail
  return fallback
}

export const parseJsonSafely = (value, fallback) => {
  if (typeof value !== 'string' || !value.trim()) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const parseStoredSession = () => {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const token = String(parsed.token ?? '').trim()
    const tokenType = String(parsed.tokenType ?? 'Bearer').trim() || 'Bearer'
    const userId = parsed.userId ? String(parsed.userId) : null
    const username = String(parsed.username ?? '').trim()
    const role = parsed.role ? String(parsed.role) : null
    const expiresAtRaw = parsed.expiresAt ? String(parsed.expiresAt) : null
    let expiresAt = null
    if (expiresAtRaw) {
      const expiresAtDate = new Date(expiresAtRaw)
      if (Number.isNaN(expiresAtDate.getTime())) return null
      expiresAt = expiresAtDate.toISOString()
    }
    if (!token || !username) return null
    if (expiresAt && Date.now() >= new Date(expiresAt).getTime()) return null
    return { token, tokenType, expiresAt, userId, username, role }
  } catch {
    return null
  }
}

const authHeaderFromSession = () => {
  const session = parseStoredSession()
  if (!session) return null
  return `${session.tokenType} ${session.token}`
}

export const setAuthSession = ({ token, tokenType = 'Bearer', expiresAt = null, userId = null, username, role }) => {
  if (typeof window === 'undefined') return null
  const normalizedToken = String(token ?? '').trim()
  const normalizedTokenType = String(tokenType ?? 'Bearer').trim() || 'Bearer'
  let normalizedExpiresAt = null
  if (expiresAt) {
    const expiresAtDate = new Date(expiresAt)
    if (!Number.isNaN(expiresAtDate.getTime())) {
      normalizedExpiresAt = expiresAtDate.toISOString()
    }
  }
  const normalizedUserId = userId ? String(userId) : null
  const normalizedUsername = String(username ?? '').trim()
  const normalizedRole = role ? String(role) : null

  if (!normalizedUsername || !normalizedToken) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }

  const next = {
    token: normalizedToken,
    tokenType: normalizedTokenType,
    expiresAt: normalizedExpiresAt,
    userId: normalizedUserId,
    username: normalizedUsername,
    role: normalizedRole,
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
  return next
}

export const clearAuthSession = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

export const getAuthSession = parseStoredSession

export const request = async (path, options = {}) => {
  const { skipAuth = false, ...fetchOptions } = options
  const authHeader = skipAuth ? null : authHeaderFromSession()

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(fetchOptions.headers ?? {}),
    },
    ...fetchOptions,
  })

  if (response.status === 204) return null

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Request failed with ${response.status}`))
  }

  return extractEnvelopeData(payload)
}

export const toDateMs = (value) => {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? Date.now() : timestamp
}

export const toIsoInstant = (value, fallback = new Date().toISOString()) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

export const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? ''))

const INVALID_TABLE_ID_MESSAGE = 'Selected table is not saved yet. Save Floor Layout first.'

export const hasPersistedTableId = (tableObjectId) => isUuid(tableObjectId)

export const ensurePersistedTableId = (tableObjectId) => {
  if (!hasPersistedTableId(tableObjectId)) {
    throw new Error(INVALID_TABLE_ID_MESSAGE)
  }
}
