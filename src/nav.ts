import { useLocation } from 'react-router-dom'

export function useBasePath() {
  const { pathname } = useLocation()
  return pathname === '/h5' || pathname.startsWith('/h5/') ? '/h5' : ''
}

export function withBase(base: string, path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (!base) {
    return normalized
  }
  if (normalized === '/') {
    return base
  }
  return `${base}${normalized}`
}
