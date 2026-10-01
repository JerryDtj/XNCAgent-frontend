import type { ChatMessage } from '../../types/chat'

type Props = {
  message: ChatMessage
  busy: boolean
  located?: boolean
  onRetry: (id: string) => void
}

function formatClock(ts: number) {
  const date = new Date(ts)
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

function BubbleBody({ message, busy, onRetry }: Props) {
  if (message.status === 'error') {
    return (
      <div className="chat-fail">
        {message.content ? <p className="chat-text">{message.content}</p> : null}
        <p className="chat-text">发送失败</p>
        <button
          type="button"
          className="chat-retry"
          disabled={busy}
          onClick={() => onRetry(message.id)}
        >
          重试
        </button>
      </div>
    )
  }
  if ((message.status === 'sending' || message.status === 'streaming') && !message.content) {
    return (
      <span className="chat-loading" role="status" aria-label="正在回复">
        <i />
        <i />
        <i />
      </span>
    )
  }
  return <p className="chat-text">{message.content}</p>
}

export default function MessageBubble({ message, busy, located = false, onRetry }: Props) {
  const mine = message.role === 'user'
  const showTime = message.status === 'done' || message.status === 'error'
  const rowClass = [mine ? 'chat-row is-user' : 'chat-row is-agent', located ? 'is-located' : ''].filter(Boolean).join(' ')
  return (
    <article className={rowClass} data-message-id={message.id}>
      <img
        className="chat-avatar"
        src={mine ? '/user_head.png' : '/agent_head.png'}
        alt={mine ? '我' : '小喜子'}
      />
      <div className="chat-stack">
        <div className={mine ? 'chat-bubble is-user' : 'chat-bubble is-agent'}>
          <BubbleBody message={message} busy={busy} onRetry={onRetry} />
        </div>
        {showTime ? <time dateTime={new Date(message.createdAt).toISOString()}>{formatClock(message.createdAt)}</time> : null}
      </div>
    </article>
  )
}
