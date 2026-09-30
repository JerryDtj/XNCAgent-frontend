export type ChatRole = 'user' | 'agent'

export type MessageStatus = 'sending' | 'streaming' | 'done' | 'error'

export type ReplyMode = 'stream' | 'complete'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  status: MessageStatus
  createdAt: number
  error?: string
}

export type ChatRequestBody = {
  message: string
  session_id: number | null
}

export type ChatSessionItem = {
  id: number
  title: string
  summary: string | null
  message_count: number
  last_message_at: string | null
}

export type ChatSessionPage = {
  items: ChatSessionItem[]
  total: number
}

export type HistoryMessage = {
  id: number
  role: string
  content: string
  created_at: string
}

export type HistoryPage = {
  items: HistoryMessage[]
  total: number
}

export type ChatReply = {
  answer: string
  session_id?: number
}
