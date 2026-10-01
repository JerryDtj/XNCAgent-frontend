import { useEffect, useRef, useState, type ReactNode } from 'react'
import { searchSessions } from '../../api/sessions'
import type { SessionSearchHit, SessionSearchResult } from '../../types/chat'
import { formatRelativeTime } from '../../utils/relativeTime'

type Props = {
  onClose: () => void
  onOpenHit: (hit: SessionSearchHit) => void
}

function highlightSnippet(snippet: string, query: string): ReactNode {
  const text = snippet.replace(/\s+/g, ' ').trim()
  const needle = query.trim()
  if (!needle) {
    return text
  }
  const lower = text.toLowerCase()
  const token = needle.toLowerCase()
  const nodes: ReactNode[] = []
  let cursor = 0
  let found = lower.indexOf(token)
  let key = 0
  if (found < 0) {
    return text
  }
  while (found >= 0) {
    if (found > cursor) {
      nodes.push(text.slice(cursor, found))
    }
    nodes.push(<strong key={key}>{text.slice(found, found + token.length)}</strong>)
    key += 1
    cursor = found + token.length
    found = lower.indexOf(token, cursor)
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }
  return nodes
}

export default function SessionSearchDialog({ onClose, onOpenHit }: Props) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SessionSearchResult | null>(null)
  const [searchedQuery, setSearchedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | null>(null)
  const seqRef = useRef(0)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  async function runSearch(raw: string) {
    const text = raw.trim()
    if (!text) {
      seqRef.current += 1
      setSearching(false)
      setResult(null)
      setError('')
      setSearchedQuery('')
      return
    }
    const seq = seqRef.current + 1
    seqRef.current = seq
    setSearching(true)
    setError('')
    try {
      const next = await searchSessions(text)
      if (seqRef.current !== seq) {
        return
      }
      setResult(next)
      setSearchedQuery(text)
    } catch (err) {
      if (seqRef.current !== seq) {
        return
      }
      setError(err instanceof Error ? err.message : '搜索失败')
    } finally {
      if (seqRef.current === seq) {
        setSearching(false)
      }
    }
  }

  function schedule(value: string) {
    clearTimer()
    const text = value.trim()
    if (!text) {
      seqRef.current += 1
      setSearching(false)
      setResult(null)
      setError('')
      setSearchedQuery('')
      return
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void runSearch(text)
    }, 300)
  }

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
      }
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const showPanel = query.trim().length > 0

  return (
    <div
      className="search-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="search-card" role="dialog" aria-modal="true" aria-label="搜索对话内容">
        <form
          className="search-bar"
          onSubmit={(event) => {
            event.preventDefault()
            clearTimer()
            void runSearch(query)
          }}
        >
          <img src="/search.png" alt="" width={20} height={20} />
          <input
            ref={inputRef}
            value={query}
            placeholder="搜索对话内容..."
            aria-label="搜索对话内容"
            onChange={(event) => {
              const value = event.target.value
              setQuery(value)
              schedule(value)
            }}
          />
          <button type="button" className="search-close" aria-label="关闭搜索" onClick={onClose}>
            ×
          </button>
        </form>
        {showPanel ? (
          <div className="search-results">
            {error ? <p className="search-error">{error}</p> : null}
            {searching ? <p className="search-loading">搜索中…</p> : null}
            {!searching && result && result.items.length === 0 ? (
              <p className="search-reply">{result.reply ?? ''}</p>
            ) : null}
            {!searching && result
              ? result.items.map((item) => {
                  const title = item.session_title.trim() || '未命名会话'
                  return (
                    <button
                      key={`${item.level}-${item.session_id}-${item.message_id ?? 'session'}`}
                      type="button"
                      className="search-hit"
                      onClick={() => onOpenHit(item)}
                    >
                      <span className="search-hit-top">
                        <span className="search-hit-title">{title}</span>
                        <span className="search-hit-time">{formatRelativeTime(item.created_at)}</span>
                      </span>
                      <span className="search-hit-snippet">{highlightSnippet(item.snippet, searchedQuery)}</span>
                    </button>
                  )
                })
              : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
