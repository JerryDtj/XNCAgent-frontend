export const API_BASE = String(import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export function apiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${normalized}`
}
