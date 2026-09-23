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

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(path, { ...init, headers })
  let body: ApiBody<T>
  try {
    body = (await res.json()) as ApiBody<T>
  } catch {
    throw new ApiError(res.status, '服务器响应异常')
  }
  if (body.code !== 0) {
    throw new ApiError(body.code, body.message || '请求失败')
  }
  return body.data as T
}
