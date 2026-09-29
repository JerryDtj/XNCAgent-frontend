import { clearAccessToken, getAccessToken, goToLogin, refreshAccessToken } from '../auth'
import { apiUrl } from '../config/env'

export type ApiBody<T> = {
  code: number
  message: string
  data?: T
}

export class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

function withAuth(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getAccessToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return { ...init, headers, credentials: 'include' }
}

function shouldRefreshOn401(path: string) {
  return (
    path !== '/api/v1/users/refresh' &&
    path !== '/api/v1/users/logout' &&
    path !== '/api/v1/users/login' &&
    path !== '/api/v1/users/send-code'
  )
}

async function send(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const res = await fetch(apiUrl(path), withAuth(init))
  if (res.status !== 401 || retried || !shouldRefreshOn401(path)) {
    return res
  }
  const ok = await refreshAccessToken()
  if (ok) {
    return send(path, init, true)
  }
  clearAccessToken()
  goToLogin()
  throw new ApiError(401, '未登录或登录已过期')
}

function isEnvelope(body: unknown): body is ApiBody<unknown> {
  return !!body && typeof body === 'object' && typeof (body as ApiBody<unknown>).code === 'number'
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, init)
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new ApiError(res.status, '服务器响应异常')
  }
  if (isEnvelope(body)) {
    if (body.code !== 0) {
      throw new ApiError(body.code, body.message || '请求失败')
    }
    return body.data as T
  }
  if (!res.ok) {
    throw new ApiError(res.status, '请求失败')
  }
  return body as T
}

export async function openStream(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await send(path, init)
  if (res.ok) {
    return res
  }
  let code = res.status
  let message = '请求失败'
  try {
    const body = (await res.json()) as ApiBody<unknown>
    if (typeof body.code === 'number') {
      code = body.code
    }
    if (body.message) {
      message = body.message
    }
  } catch {
    message = '服务器响应异常'
  }
  throw new ApiError(code, message)
}
