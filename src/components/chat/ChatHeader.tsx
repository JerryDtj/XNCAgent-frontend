type Props = {
  title: string
  toneTag: string
  onBack: () => void
}

export default function ChatHeader({ title, toneTag, onBack }: Props) {
  return (
    <header className="chat-header">
      <div className="chat-header-main">
        <button type="button" className="chat-back" onClick={onBack} aria-label="返回">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 5 8 12l7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="chat-title">{title}</h1>
      </div>
      <div className="chat-header-side">
        <span className="chat-online">
          <i />
          在线
        </span>
        <span className="chat-tone">{toneTag}</span>
      </div>
    </header>
  )
}
