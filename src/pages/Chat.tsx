import { logout } from '../auth'
import ChatPhone from '../components/chat/ChatPhone'
import { CHAT_PAGE_TITLE, CHAT_TONE_TAG } from '../config/api'
import { useChatSession } from '../hooks/useChatSession'

export default function Chat() {
  const session = useChatSession()

  function leave() {
    session.abort()
    void logout()
  }

  return (
    <div className="chat-stage">
      <div className="chat-frame">
        <img className="chat-mascot" src="/xnc.png" alt="" />
        <ChatPhone
          title={CHAT_PAGE_TITLE}
          toneTag={CHAT_TONE_TAG}
          messages={session.messages}
          mode={session.mode}
          busy={session.busy}
          onBack={leave}
          onModeChange={session.setMode}
          onSend={session.send}
          onStop={session.abort}
          onRetry={session.retry}
        />
      </div>
    </div>
  )
}
