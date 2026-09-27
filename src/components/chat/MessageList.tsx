import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../types/chat'
import MessageBubble from './MessageBubble'

type Props = {
  messages: ChatMessage[]
  busy: boolean
  onRetry: (id: string) => void
}

export default function MessageList({ messages, busy, onRetry }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) {
      return
    }
    list.scrollTop = list.scrollHeight
  }, [messages])

  return (
    <div className="chat-list" ref={listRef}>
      {messages.length === 0 ? <p className="chat-empty">说一句，小喜子接着聊。</p> : null}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} busy={busy} onRetry={onRetry} />
      ))}
    </div>
  )
}
