import { useState } from 'react'
import { logout } from '../auth'
import ChatPhone from '../components/chat/ChatPhone'
import SessionSidebar from '../components/chat/SessionSidebar'
import { CHAT_PAGE_TITLE, CHAT_TONE_TAG } from '../config/api'
import { useChatSession } from '../hooks/useChatSession'

export default function Chat() {
  const session = useChatSession()
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia('(min-width: 768px)').matches,
  )

  function onLogout() {
    session.abort()
    void logout()
  }

  function openSession(id: number) {
    void session.openSession(id)
    if (window.matchMedia('(max-width: 767px)').matches) {
      setSidebarOpen(false)
    }
  }

  function newSession() {
    session.beginNewSession()
    if (window.matchMedia('(max-width: 767px)').matches) {
      setSidebarOpen(false)
    }
  }

  return (
    <div className={sidebarOpen ? 'chat-stage has-sidebar' : 'chat-stage'}>
      <img className="chat-mascot" src="/xnc.png" alt="" />
      {sidebarOpen ? (
        <button type="button" className="chat-sidebar-mask" aria-label="关闭会话列表" onClick={() => setSidebarOpen(false)} />
      ) : null}
      <SessionSidebar
        open={sidebarOpen}
        sessions={session.sessions}
        total={session.sessionsTotal}
        loading={session.sessionsLoading}
        error={session.sessionsError}
        currentId={session.sessionId}
        onNew={newSession}
        onOpen={openSession}
        onRename={session.renameSession}
        onDelete={session.deleteSession}
        onLoadMore={session.loadMoreSessions}
      />
      <div className="chat-frame">
        <ChatPhone
          title={CHAT_PAGE_TITLE}
          toneTag={CHAT_TONE_TAG}
          sidebarOpen={sidebarOpen}
          messages={session.messages}
          mode={session.mode}
          busy={session.busy}
          restoring={session.restoring}
          notice={session.notice}
          focusSignal={session.focusSignal}
          onToggleSessions={() => setSidebarOpen((open) => !open)}
          onLogout={onLogout}
          onModeChange={session.setMode}
          onSend={session.send}
          onStop={session.abort}
          onRetry={session.retry}
        />
      </div>
    </div>
  )
}
