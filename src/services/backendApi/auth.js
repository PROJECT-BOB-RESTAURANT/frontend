import { request } from './core'

export const login = (credentials) =>
  request('/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      username: credentials.username,
      password: credentials.password,
    }),
  })

export const register = (payload) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: payload.username,
      password: payload.password,
      role: payload.role,
    }),
  })

export const listUsers = (query = '') => {
  const normalized = String(query ?? '').trim()
  const params = normalized ? `?query=${encodeURIComponent(normalized)}` : ''
  return request(`/auth/users${params}`)
}
