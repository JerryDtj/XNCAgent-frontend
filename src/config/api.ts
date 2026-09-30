export const CHAT_API = {
  send: '/agent/chat',
  stream: '/agent/chat/stream',
  sessions: '/agent/sessions',
} as const

export const SESSION_PAGE_SIZE = 20
export const HISTORY_PAGE_SIZE = 30

export const CHAT_PAGE_TITLE = '大内陪聊官'
export const CHAT_TONE_TAG = '轻松吐槽模式'
