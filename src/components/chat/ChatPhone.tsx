import ChatComposer from './ChatComposer'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import type { ChatMessage, ReplyMode } from '../../types/chat'

type Props = {
  title: string
  toneTag: string
  messages: ChatMessage[]
  mode: ReplyMode
  busy: boolean
  onBack: () => void
  onModeChange: (mode: ReplyMode) => void
  onSend: (text: string) => void
  onStop: () => void
  onRetry: (id: string) => void
}

export default function ChatPhone({
  title,
  toneTag,
  messages,
  mode,
  busy,
  onBack,
  onModeChange,
  onSend,
  onStop,
  onRetry,
}: Props) {
  return (
    <section className="chat-phone" aria-label={title}>
      <ChatHeader title={title} toneTag={toneTag} onBack={onBack} />
      <MessageList messages={messages} busy={busy} onRetry={onRetry} />
      <ChatComposer
        mode={mode}
        busy={busy}
        onModeChange={onModeChange}
        onSend={onSend}
        onStop={onStop}
      />
    </section>
  )
}
