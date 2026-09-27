import { CHAT_API } from '../config/api'
import type { ChatReply, ChatRequestBody } from '../types/chat'
import { request } from './client'

const CHAT_TIMEOUT_MS = 120_000

export function sendChat(body: ChatRequestBody, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(CHAT_TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  return request<ChatReply>(CHAT_API.send, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: combined,
  })
}
