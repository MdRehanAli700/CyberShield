const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}

export function timeoutSignal(milliseconds) {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') {
    return undefined
  }

  return AbortSignal.timeout(milliseconds)
}
