import { type FormEvent, type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReplyMode } from '../../types/chat'

type Props = {
  mode: ReplyMode
  busy: boolean
  hold?: boolean
  focusSignal?: number
  onModeChange: (mode: ReplyMode) => void
  onSend: (text: string) => void
  onStop: () => void
}

const MODE_PLACEHOLDER = {
  stream: '流式回复：逐字输出，可随时停止',
  complete: '非流式回复：一次性展示全部结果',
} as const

const MIN_INPUT_HEIGHT = 48
const MAX_INPUT_HEIGHT = 144

function fitTextarea(el: HTMLTextAreaElement) {
  el.style.height = `${MIN_INPUT_HEIGHT}px`
  const next = Math.min(Math.max(el.scrollHeight, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT)
  el.style.height = `${next}px`
}

export default function ChatComposer({ mode, busy, hold = false, focusSignal = 0, onModeChange, onSend, onStop }: Props) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const composingRef = useRef(false)
  const placeholder = MODE_PLACEHOLDER[mode]
  const locked = busy || hold
  const canSend = draft.trim().length > 0 && !locked

  function toggleMode() {
    onModeChange(mode === 'stream' ? 'complete' : 'stream')
  }

  useLayoutEffect(() => {
    const input = inputRef.current
    if (input) {
      fitTextarea(input)
    }
  }, [draft])

  useEffect(() => {
    if (!focusSignal) {
      return
    }
    inputRef.current?.focus()
  }, [focusSignal])

  function submit() {
    const text = draft.trim()
    if (!text || locked) {
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
    if (event.key !== 'Enter' || event.shiftKey) {
      return
    }
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) {
      return
    }
    event.preventDefault()
    submit()
  }

  return (
    <div className="chat-dock">
      <form className={busy ? 'chat-composer is-busy' : 'chat-composer'} onSubmit={onSubmit}>
        <span className="chat-mode-wrap">
          <button
            type="button"
            className="chat-mode"
            aria-label={placeholder}
            onClick={toggleMode}
          >
            <img src={mode === 'stream' ? '/open.png' : '/close.png'} alt="" />
          </button>
        </span>
        <textarea
          ref={inputRef}
          className="chat-input"
          rows={2}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onCompositionStart={() => {
            composingRef.current = true
          }}
          onCompositionEnd={() => {
            composingRef.current = false
          }}
        />
        <button type="submit" className="chat-send chat-send-submit" disabled={!canSend} aria-label="发送">
          <img src="/send.png" alt="" />
        </button>
        {busy ? (
          <button type="button" className="chat-send" aria-label="停止" onClick={onStop}>
            <img src="/stop.png" alt="" />
          </button>
        ) : null}
      </form>
    </div>
  )
}
