import ChatComposer from './ChatComposer'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import type { ChatMessage, ReplyMode } from '../../types/chat'

type Props = {
  title: string
  toneTag: string
  sidebarOpen: boolean
  messages: ChatMessage[]
  mode: ReplyMode
  busy: boolean
  restoring: boolean
  notice: string
  focusSignal: number
  onToggleSessions: () => void
  onLogout: () => void
  onModeChange: (mode: ReplyMode) => void
  onSend: (text: string) => void
  onStop: () => void
  onRetry: (id: string) => void
}

export default function ChatPhone({
  title,
  toneTag,
  sidebarOpen,
  messages,
  mode,
  busy,
  restoring,
  notice,
  focusSignal,
  onToggleSessions,
  onLogout,
  onModeChange,
  onSend,
  onStop,
  onRetry,
}: Props) {
  return (
    <section className="chat-phone" aria-label={title}>
      <ChatHeader
        title={title}
        toneTag={toneTag}
        sidebarOpen={sidebarOpen}
        onToggleSessions={onToggleSessions}
        onLogout={onLogout}
      />
      <MessageList messages={messages} busy={busy} restoring={restoring} notice={notice} onRetry={onRetry} />
      <ChatComposer
        mode={mode}
        busy={busy}
        hold={restoring}
        focusSignal={focusSignal}
        onModeChange={onModeChange}
        onSend={onSend}
        onStop={onStop}
      />
    </section>
  )
}
