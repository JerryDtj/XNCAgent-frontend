import { useEffect, useRef, useState } from 'react'
import type { ChatSessionItem } from '../../types/chat'
import { formatRelativeTime } from '../../utils/relativeTime'

type Props = {
  open: boolean
  sessions: ChatSessionItem[]
  total: number
  loading: boolean
  error: string
  currentId: number | null
  searchOpen: boolean
  onToggleSearch: () => void
  onNew: () => void
  onOpen: (id: number) => void
  onRename: (id: number, title: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onLoadMore: () => Promise<void>
}

export default function SessionSidebar({
  open,
  sessions,
  total,
  loading,
  error,
  currentId,
  searchOpen,
  onToggleSearch,
  onNew,
  onOpen,
  onRename,
  onDelete,
  onLoadMore,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [rowError, setRowError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [actionsId, setActionsId] = useState<number | null>(null)
  const suppressOpenRef = useRef(false)
  const listRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)
  const onLoadMoreRef = useRef(onLoadMore)
  const hasMoreRef = useRef(false)
  const hasMore = sessions.length < total
  onLoadMoreRef.current = onLoadMore
  hasMoreRef.current = hasMore

  useEffect(() => {
    if (actionsId != null && !sessions.some((item) => item.id === actionsId)) {
      setActionsId(null)
    }
  }, [actionsId, sessions])

  function cancelEdit() {
    setEditingId(null)
    setDraft('')
  }

  async function saveTitle(id: number) {
    const title = draft.trim()
    if (!title) {
      setRowError('标题不能为空')
      return
    }
    setRowError('')
    try {
      await onRename(id, title)
      cancelEdit()
    } catch (err) {
      setRowError(err instanceof Error ? err.message : '改名失败')
    }
  }

  async function remove(item: ChatSessionItem) {
    const name = item.title.trim() || '未命名会话'
    if (!window.confirm(`删除「${name}」？`)) {
      return
    }
    setRowError('')
    const index = sessions.findIndex((row) => row.id === item.id)
    const neighbor = sessions[index + 1] ?? sessions[index - 1] ?? null
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    suppressOpenRef.current = true
    window.setTimeout(() => {
      suppressOpenRef.current = false
    }, 500)
    try {
      await onDelete(item.id)
      setActionsId(neighbor && neighbor.id !== item.id ? neighbor.id : null)
    } catch (err) {
      setRowError(err instanceof Error ? err.message : '删除失败')
    }
  }

  useEffect(() => {
    const list = listRef.current
    if (!list) {
      return
    }
    let timer: number | null = null
    const run = () => {
      timer = null
      if (loadingMoreRef.current || !hasMoreRef.current || list.clientHeight < 1) {
        return
      }
      const gap = list.scrollHeight - list.scrollTop - list.clientHeight
      if (gap > 40) {
        return
      }
      loadingMoreRef.current = true
      setLoadingMore(true)
      setRowError('')
      void onLoadMoreRef.current()
        .catch((err: unknown) => {
          setRowError(err instanceof Error ? err.message : '加载更多失败')
        })
        .finally(() => {
          loadingMoreRef.current = false
          setLoadingMore(false)
        })
    }
    const schedule = () => {
      if (timer != null) {
        window.clearTimeout(timer)
      }
      timer = window.setTimeout(run, 300)
    }
    list.addEventListener('scroll', schedule, { passive: true })
    schedule()
    return () => {
      list.removeEventListener('scroll', schedule)
      if (timer != null) {
        window.clearTimeout(timer)
      }
    }
  }, [open, sessions.length, total])

  return (
    <aside className={open ? 'chat-sidebar is-open' : 'chat-sidebar'} aria-label="会话列表">
      <div className="chat-sidebar-bar">
        <button type="button" className="chat-new" onClick={onNew}>
          新建会话
        </button>
        <button
          type="button"
          className="chat-search-open"
          aria-label="搜索历史聊天"
          aria-pressed={searchOpen}
          onClick={onToggleSearch}
        >
          <img src="/search.png" alt="" width={24} height={24} />
        </button>
      </div>
      {error ? <p className="chat-sidebar-error">{error}</p> : null}
      {rowError ? <p className="chat-sidebar-error">{rowError}</p> : null}
      <div className="chat-sidebar-list" ref={listRef} aria-busy={loadingMore}>
        {loading && sessions.length === 0 ? <p className="chat-sidebar-empty">会话加载中…</p> : null}
        {!loading && sessions.length === 0 ? (
          <p className="chat-sidebar-empty">点新建会话，跟小喜子开聊</p>
        ) : null}
        {sessions.map((item) => {
          const current = item.id === currentId
          const editing = editingId === item.id
          const revealed = actionsId === item.id
          const name = item.title.trim() || '未命名会话'
          const rowClass = [
            'chat-session',
            current ? 'is-current' : '',
            revealed ? 'is-actions' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <div key={item.id} className={rowClass}>
              {editing ? (
                <form
                  className="chat-rename"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void saveTitle(item.id)
                  }}
                >
                  <input
                    value={draft}
                    aria-label="会话标题"
                    autoFocus
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={(event) => {
                      if (event.currentTarget.form?.contains(event.relatedTarget as Node | null)) {
                        return
                      }
                      cancelEdit()
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelEdit()
                      }
                    }}
                  />
                  <div className="chat-session-actions is-editing">
                    <button type="submit" onMouseDown={(event) => event.preventDefault()}>
                      保存
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className="chat-session-main"
                    onClick={() => {
                      if (suppressOpenRef.current) {
                        return
                      }
                      setActionsId(null)
                      onOpen(item.id)
                    }}
                  >
                    <span className="chat-session-title" title={name}>
                      {name}
                    </span>
                    <span className="chat-session-time">{formatRelativeTime(item.last_message_at)}</span>
                  </button>
                  <div className="chat-session-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(item.title)
                        setEditingId(item.id)
                        setRowError('')
                      }}
                    >
                      改名
                    </button>
                    <button type="button" onClick={() => void remove(item)}>
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
