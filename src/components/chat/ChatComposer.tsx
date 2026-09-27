import { type FormEvent, type KeyboardEvent, useState } from 'react'
import type { ReplyMode } from '../../types/chat'

type Props = {
  mode: ReplyMode
  busy: boolean
  onModeChange: (mode: ReplyMode) => void
  onSend: (text: string) => void
  onStop: () => void
}

const MODE_TIP = {
  stream: '流式回复：逐字输出，可随时停止',
  complete: '非流式回复：等待完整结果',
} as const

export default function ChatComposer({ mode, busy, onModeChange, onSend, onStop }: Props) {
  const [draft, setDraft] = useState('')
  const placeholder = mode === 'stream' ? '请输入…' : '发送后等待完整回复…'
  const modeTip = MODE_TIP[mode]

  function submit() {
    const text = draft.trim()
    if (!text || busy) {
      return
    }
    setDraft('')
    onSend(text)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    submit()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="chat-dock">
      <form className="chat-composer" onSubmit={onSubmit}>
        <button
          type="button"
          className="chat-mode"
          title={modeTip}
          aria-label={modeTip}
          onClick={() => onModeChange(mode === 'stream' ? 'complete' : 'stream')}
        >
          <img src={mode === 'stream' ? '/open.png' : '/close.png'} alt="" />
        </button>
        <textarea
          className="chat-input"
          rows={1}
          value={draft}
          placeholder={placeholder}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {busy ? (
          <button type="button" className="chat-send" aria-label="停止" onClick={onStop}>
            <img src="/stop.png" alt="" />
          </button>
        ) : (
          <button type="submit" className="chat-send" disabled={!draft.trim()} aria-label="发送">
            <img src="/send.png" alt="" />
          </button>
        )}
      </form>
    </div>
  )
}
