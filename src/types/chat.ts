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
  session_id?: number
}

export type ChatReply = {
  answer: string
  session_id?: number
}
