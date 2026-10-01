import { request } from './client'
import { CHAT_API, HISTORY_PAGE_SIZE, SESSION_PAGE_SIZE } from '../config/api'
import type { ChatSessionPage, HistoryPage, SessionSearchResult } from '../types/chat'

function pageQuery(page: number, pageSize: number) {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  return query.toString()
}

export function listSessions(page = 1, pageSize = SESSION_PAGE_SIZE) {
  return request<ChatSessionPage>(`${CHAT_API.sessions}?${pageQuery(page, pageSize)}`)
}

export function renameSession(id: number, title: string) {
  return request<{ id: number; title: string }>(`${CHAT_API.sessions}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export function deleteSession(id: number) {
  return request<{ id: number }>(`${CHAT_API.sessions}/${id}`, {
    method: 'DELETE',
  })
}

export function searchSessions(query: string) {
  return request<SessionSearchResult>(`${CHAT_API.sessions}/search`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  })
}

export function listSessionMessages(id: number, page = 1, pageSize = HISTORY_PAGE_SIZE) {
  return request<HistoryPage>(`${CHAT_API.sessions}/${id}/messages?${pageQuery(page, pageSize)}`)
}

export function listMessagesAround(id: number, around: number, before = 2, after = 3) {
  const query = new URLSearchParams({
    around: String(around),
    before: String(before),
    after: String(after),
  })
  return request<HistoryPage>(`${CHAT_API.sessions}/${id}/messages?${query}`)
}
