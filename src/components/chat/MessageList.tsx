import { useEffect, useLayoutEffect, useRef } from 'react'
import type { ChatMessage } from '../../types/chat'
import MessageBubble from './MessageBubble'

type Props = {
  messages: ChatMessage[]
  busy: boolean
  restoring: boolean
  notice: string
  locateMessageId: string | null
  onLocateDone: () => void
  anchored: boolean
  hasEarlier: boolean
  loadingEarlier: boolean
  onLoadEarlier: () => void
  onJumpLatest: () => void
  onRetry: (id: string) => void
}

export default function MessageList({
  messages,
  busy,
  restoring,
  notice,
  locateMessageId,
  onLocateDone,
  anchored,
  hasEarlier,
  loadingEarlier,
  onLoadEarlier,
  onJumpLatest,
  onRetry,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onLocateDone)
  const skipBottomRef = useRef(false)
  const firstIdRef = useRef<string | null>(null)
  const heightRef = useRef(0)
  doneRef.current = onLocateDone

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) {
      return
    }
    const firstId = messages[0]?.id ?? null
    const prevFirst = firstIdRef.current
    const prepended =
      !restoring &&
      prevFirst != null &&
      firstId != null &&
      firstId !== prevFirst &&
      messages.some((item) => item.id === prevFirst)
    if (prepended) {
      list.scrollTop += list.scrollHeight - heightRef.current
      skipBottomRef.current = true
    } else if (!restoring && locateMessageId) {
      const node = list.querySelector(`[data-message-id="${CSS.escape(locateMessageId)}"]`)
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ block: 'center' })
      }
    } else if (!restoring && !skipBottomRef.current) {
      list.scrollTop = list.scrollHeight
    } else if (!restoring) {
      skipBottomRef.current = false
    }
    firstIdRef.current = firstId
    heightRef.current = list.scrollHeight
  }, [messages, restoring, locateMessageId])

  useEffect(() => {
    if (!locateMessageId || restoring) {
      return
    }
    const list = listRef.current
    const node = list?.querySelector(`[data-message-id="${CSS.escape(locateMessageId)}"]`)
    if (!(node instanceof HTMLElement)) {
      if (messages.length > 0) {
        doneRef.current()
      }
      return
    }
    const timer = window.setTimeout(() => {
      skipBottomRef.current = true
      doneRef.current()
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [locateMessageId, restoring, messages])

  return (
    <div className="chat-list" ref={listRef}>
      {notice ? <p className="chat-empty">{notice}</p> : null}
      {restoring ? <p className="chat-empty">正在打开会话…</p> : null}
      {!notice && !restoring && messages.length === 0 ? <p className="chat-empty">说一句，小喜子接着聊。</p> : null}
      {anchored && hasEarlier ? (
        <button type="button" className="chat-history-nav" disabled={loadingEarlier} onClick={onLoadEarlier}>
          {loadingEarlier ? '加载中…' : '加载更早'}
        </button>
      ) : null}
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          busy={busy}
          located={message.id === locateMessageId}
          onRetry={onRetry}
        />
      ))}
      {anchored ? (
        <button type="button" className="chat-history-nav" disabled={restoring} onClick={onJumpLatest}>
          回到最新
        </button>
      ) : null}
    </div>
  )
}
