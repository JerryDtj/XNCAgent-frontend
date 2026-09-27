import { useNavigate } from 'react-router-dom'
import { clearTokens } from '../auth/session'
import ChatPhone from '../components/chat/ChatPhone'
import { CHAT_PAGE_TITLE, CHAT_TONE_TAG } from '../config/api'
import { useChatSession } from '../hooks/useChatSession'
import { useBasePath, withBase } from '../nav'

export default function Chat() {
  const navigate = useNavigate()
  const base = useBasePath()
  const session = useChatSession()

  function leave() {
    session.abort()
    clearTokens()
    navigate(withBase(base, '/login'), { replace: true })
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
