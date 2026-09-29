import { apiUrl } from './config/env'

let accessToken: string | null = null
let refreshInFlight: Promise<boolean> | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string) {
  accessToken = token
}

export function clearAccessToken() {
  accessToken = null
}

function loginPath() {
  const path = window.location.pathname
  const base = path === '/h5' || path.startsWith('/h5/') ? '/h5' : ''
  return base ? `${base}/login` : '/login'
}

export function goToLogin() {
  const target = loginPath()
  if (window.location.pathname === target) {
    return
  }
  window.location.replace(target)
}

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/v1/users/refresh'), {
      method: 'POST',
      credentials: 'include',
    })
    if (res.status !== 200) {
      return false
    }
    const body = (await res.json()) as { data?: { access_token?: string } }
    const token = body?.data?.access_token
    if (typeof token !== 'string' || !token) {
      return false
    }
    accessToken = token
    return true
  } catch {
    return false
  }
}

export function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

export function boot(): Promise<boolean> {
  return refreshAccessToken()
}

export async function logout() {
  try {
    await fetch(apiUrl('/api/v1/users/logout'), {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    /* cookie 清不掉也先退出本地 */
  } finally {
    clearAccessToken()
    goToLogin()
  }
}
