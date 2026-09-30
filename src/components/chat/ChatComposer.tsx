import { type FormEvent, type KeyboardEvent, useLayoutEffect, useRef, useState } from 'react'
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

const MIN_INPUT_HEIGHT = 48
const MAX_INPUT_HEIGHT = 144

function fitTextarea(el: HTMLTextAreaElement) {
  el.style.height = `${MIN_INPUT_HEIGHT}px`
  const next = Math.min(Math.max(el.scrollHeight, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT)
  el.style.height = `${next}px`
}

export default function ChatComposer({ mode, busy, onModeChange, onSend, onStop }: Props) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const composingRef = useRef(false)
  const placeholder = mode === 'stream' ? '请输入…' : '发送后等待完整回复…'
  const modeTip = MODE_TIP[mode]
  const canSend = draft.trim().length > 0 && !busy

  useLayoutEffect(() => {
    const input = inputRef.current
    if (input) {
      fitTextarea(input)
    }
  }, [draft])

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
        <button type="submit" className="chat-send" disabled={!canSend} aria-label="发送">
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
