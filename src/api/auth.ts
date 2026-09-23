import { request } from './client'

export type RegisterResult = {
  user_id: number
  email: string
}

export type TokenPair = {
  access_token: string
  refresh_token: string
  expires_in: number
}

export type Me = {
  user_id: number
  email: string
}

export function sendRegisterCode(email: string) {
  return request<{ expires_in: number }>('/api/v1/users/send-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function register(email: string, password: string, code: string) {
  return request<RegisterResult>('/api/v1/users/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, code }),
  })
}

export function login(email: string, password: string) {
  return request<TokenPair>('/api/v1/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function me() {
  return request<Me>('/api/v1/users/me')
}
