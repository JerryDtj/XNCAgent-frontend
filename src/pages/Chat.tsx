import { useEffect, useState } from 'react'
import { logout } from '../auth'
import { closeMusicCard, latestMusicCard, musicSessionKey, subscribeMusic } from '../chat/musicStore'
import ChatPhone from '../components/chat/ChatPhone'
import MusicBubble from '../components/chat/MusicBubble'
import SessionSearchDialog from '../components/chat/SessionSearchDialog'
import SessionSidebar from '../components/chat/SessionSidebar'
import { CHAT_PAGE_TITLE, CHAT_TONE_TAG } from '../config/api'
import { useChatSession } from '../hooks/useChatSession'
import { useTouchLayout } from '../hooks/useTouchLayout'
import type { SessionSearchHit } from '../types/chat'

export default function Chat() {
  const session = useChatSession()
  const touchLayout = useTouchLayout()
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia('(min-width: 768px)').matches,
  )
  const [searchOpen, setSearchOpen] = useState(false)
  const [, setMusicRev] = useState(0)

  useEffect(() => subscribeMusic(() => setMusicRev((value) => value + 1)), [])

  const activeKey = musicSessionKey(session.sessionId, session.draftToken)
  const desktopCard = !touchLayout ? latestMusicCard(activeKey) : null

  function onLogout() {
    session.stopAll()
    void logout()
  }

  function openSession(id: number, messageId?: number | null) {
    void session.openSession(id, messageId)
    if (window.matchMedia('(max-width: 767px)').matches) {
      setSidebarOpen(false)
    }
  }

  function openSearchHit(hit: SessionSearchHit) {
    setSearchOpen(false)
    const messageId = hit.level === 'message' ? hit.message_id : null
    openSession(hit.session_id, messageId)
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
      {!touchLayout && desktopCard && !desktopCard.closed ? (
        <MusicBubble card={desktopCard} onClose={closeMusicCard} />
      ) : null}
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
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((open) => !open)}
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
          onStop={session.stop}
          onRetry={session.retry}
          locateMessageId={session.locateMessageId}
          onLocateDone={() => session.setLocateMessageId(null)}
          anchored={session.anchored}
          hasEarlier={session.hasEarlier}
          loadingEarlier={session.loadingEarlier}
          onLoadEarlier={() => void session.loadEarlier()}
          onJumpLatest={() => void session.jumpLatest()}
          touchLayout={touchLayout}
          musicSessionKey={activeKey}
        />
      </div>
      {searchOpen ? <SessionSearchDialog onClose={() => setSearchOpen(false)} onOpenHit={openSearchHit} /> : null}
    </div>
  )
}
