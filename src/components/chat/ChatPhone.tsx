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
  locateMessageId: string | null
  onLocateDone: () => void
  anchored: boolean
  hasEarlier: boolean
  loadingEarlier: boolean
  onLoadEarlier: () => void
  onJumpLatest: () => void
  onToggleSessions: () => void
  onLogout: () => void
  onModeChange: (mode: ReplyMode) => void
  onSend: (text: string) => void
  onStop: () => void
  onRetry: (id: string) => void
  touchLayout: boolean
  musicSessionKey: string | null
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
  locateMessageId,
  onLocateDone,
  anchored,
  hasEarlier,
  loadingEarlier,
  onLoadEarlier,
  onJumpLatest,
  onToggleSessions,
  onLogout,
  onModeChange,
  onSend,
  onStop,
  onRetry,
  touchLayout,
  musicSessionKey,
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
      <MessageList
        messages={messages}
        busy={busy}
        restoring={restoring}
        notice={notice}
        locateMessageId={locateMessageId}
        onLocateDone={onLocateDone}
        anchored={anchored}
        hasEarlier={hasEarlier}
        loadingEarlier={loadingEarlier}
        onLoadEarlier={onLoadEarlier}
        onJumpLatest={onJumpLatest}
        onRetry={onRetry}
        touchLayout={touchLayout}
        musicSessionKey={musicSessionKey}
      />
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
