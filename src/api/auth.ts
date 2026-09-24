import { request } from './client'

export type TokenPair = {
  access_token: string
  refresh_token: string
  expires_in: number
}

export type Me = {
  user_id: number
  email: string
}

export function sendLoginCode(email: string) {
  return request<{ expires_in: number }>('/api/v1/users/send-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function login(email: string, code: string) {
  return request<TokenPair>('/api/v1/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
}

export function me() {
  return request<Me>('/api/v1/users/me')
}
