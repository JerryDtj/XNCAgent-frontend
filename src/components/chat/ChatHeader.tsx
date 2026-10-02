import { useState } from 'react'
import SettingsPanel from './SettingsPanel'

// 后续会加 "invisible" | "offline"
type Presence = 'online'

const PRESENCE_LABEL: Record<Presence, string> = {
  online: '在线',
}

type Props = {
  title: string
  toneTag: string
  sidebarOpen: boolean
  onToggleSessions: () => void
  onLogout: () => void
}

export default function ChatHeader({ title, toneTag, sidebarOpen, onToggleSessions, onLogout }: Props) {
  const [presence] = useState<Presence>('online')
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <header className="chat-header">
      <div className="chat-header-main">
        <button
          type="button"
          className="chat-sidebar-chevron"
          onClick={onToggleSessions}
          aria-label={sidebarOpen ? '收起会话列表' : '展开会话列表'}
        >
          <img src={sidebarOpen ? '/dayu.png' : '/xiaoyu.png'} alt="" />
        </button>
        <h1 className="chat-title">{title}</h1>
      </div>
      <div className="chat-header-side">
        <div className="chat-presence">
          <button type="button" className="chat-online" aria-haspopup="menu">
            <i />
            {PRESENCE_LABEL[presence]}
          </button>
          <div className="chat-presence-menu" role="menu">
            <button type="button" role="menuitem" onClick={onLogout}>
              退出
            </button>
          </div>
        </div>
        <span className="chat-tone">{toneTag}</span>
        <button
          type="button"
          className="chat-settings-open"
          aria-label="打开设置"
          aria-pressed={settingsOpen}
          onClick={() => setSettingsOpen(true)}
        >
          <img src="/setting.png" alt="" width={22} height={22} />
        </button>
      </div>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  )
}
