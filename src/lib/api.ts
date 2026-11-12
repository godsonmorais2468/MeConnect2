import { demoRequest } from './demoApi'

export function getTokens() {
  const raw = localStorage.getItem('me-connect:tokens') || sessionStorage.getItem('me-connect:tokens')
  if (!raw) return null
  try {
    return JSON.parse(raw) as { access: string; refresh: string }
  } catch {
    return null
  }
}

export function setTokens(tokens: { access: string; refresh: string }, remember: boolean) {
  const store = remember ? localStorage : sessionStorage
  store.setItem('me-connect:tokens', JSON.stringify(tokens))
}

export function clearTokens() {
  localStorage.removeItem('me-connect:tokens')
  sessionStorage.removeItem('me-connect:tokens')
}

export const SUBSCRIPTION_REQUIRED_EVENT = 'me-connect:subscription-required'

/** The prototype has no server: every request is answered in the browser from sample data (see demoApi.ts). */
export function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string; code?: string; status: number }> {
  return demoRequest<T>(endpoint, options)
}
