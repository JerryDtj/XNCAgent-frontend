import { getAccessToken } from '../auth/session'

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
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return { ...init, headers }
}

function isEnvelope(body: unknown): body is ApiBody<unknown> {
  return !!body && typeof body === 'object' && typeof (body as ApiBody<unknown>).code === 'number'
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, withAuth(init))
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
  const res = await fetch(path, withAuth(init))
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
