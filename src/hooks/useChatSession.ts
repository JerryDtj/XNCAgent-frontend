import { useCallback, useEffect, useRef, useState } from 'react'
import { sendChat } from '../api/chat'
import { ApiError } from '../api/client'
import { deleteSession, listSessionMessages, listSessions, renameSession } from '../api/sessions'
import { clearAccessToken, goToLogin } from '../auth'
import { SESSION_PAGE_SIZE } from '../config/api'
import type { ChatMessage, ChatRequestBody, ChatSessionItem, ReplyMode } from '../types/chat'
import { createId } from '../utils/createId'
import { useStreamingChat } from './useStreamingChat'

function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError'
}

function isNotFound(err: unknown) {
  return err instanceof ApiError && err.code === 404
}

function userTextFor(messages: ChatMessage[], agentId: string) {
  const index = messages.findIndex((item) => item.id === agentId)
  for (let i = index - 1; i >= 0; i -= 1) {
    const item = messages[i]
    if (item.role === 'user') {
      return item.content
    }
  }
  return ''
}

function toChatMessage(item: { id: number; role: string; content: string; created_at: string }): ChatMessage {
  const createdAt = Date.parse(item.created_at)
  return {
    id: String(item.id),
    role: item.role === 'user' ? 'user' : 'agent',
    content: item.content ?? '',
    status: 'done',
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
  }
}

function stubSession(id: number): ChatSessionItem {
  return {
    id,
    title: '',
    summary: null,
    message_count: 0,
    last_message_at: new Date().toISOString(),
  }
}

export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [mode, setMode] = useState<ReplyMode>('stream')
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessions, setSessions] = useState<ChatSessionItem[]>([])
  const [sessionsTotal, setSessionsTotal] = useState(0)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState('')
  const [notice, setNotice] = useState('')
  const [focusSignal, setFocusSignal] = useState(0)
  const busyRef = useRef(false)
  const activeAgentRef = useRef<string | null>(null)
  const completeAbortRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef<number | null>(null)
  const restoringRef = useRef(false)
  const epochRef = useRef(0)
  const pageRef = useRef(1)
  const titleTimerRef = useRef<number | null>(null)
  const { start, abort: abortStream } = useStreamingChat()

  const rememberSession = useCallback((id: number) => {
    sessionIdRef.current = id
    setSessionId(id)
    setSessions((prev) => (prev.some((item) => item.id === id) ? prev : [stubSession(id), ...prev]))
  }, [])

  const requestBody = useCallback((message: string): ChatRequestBody => {
    return { message, session_id: sessionIdRef.current }
  }, [])

  const rejectUnauthorized = useCallback((err: unknown) => {
    if (!(err instanceof ApiError) || (err.code !== 401 && err.code !== 40101)) {
      return false
    }
    clearAccessToken()
    goToLogin()
    return true
  }, [])

  const patch = useCallback((id: string, next: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((item) => (item.id === id ? { ...item, ...next } : item)))
  }, [])

  const finish = useCallback(() => {
    busyRef.current = false
    setBusy(false)
  }, [])

  const applySessionPage = useCallback((items: ChatSessionItem[], total: number, replace: boolean) => {
    setSessionsTotal(total)
    setSessions((prev) => {
      const pageItems = replace ? items : mergeSessions(prev, items)
      const current = sessionIdRef.current
      if (current != null && !pageItems.some((item) => item.id === current)) {
        const known = prev.find((item) => item.id === current) ?? stubSession(current)
        return [known, ...pageItems]
      }
      return pageItems
    })
  }, [])

  const refreshSessions = useCallback(async () => {
    const page = await listSessions(1, SESSION_PAGE_SIZE)
    pageRef.current = 1
    const items = Array.isArray(page.items) ? page.items : []
    applySessionPage(items, page.total ?? items.length, true)
    setSessionsError('')
    return items
  }, [applySessionPage])

  const scheduleTitleRefresh = useCallback(
    (id: number) => {
      if (titleTimerRef.current != null) {
        window.clearTimeout(titleTimerRef.current)
      }
      titleTimerRef.current = window.setTimeout(() => {
        titleTimerRef.current = null
        if (sessionIdRef.current !== id) {
          return
        }
        void refreshSessions().catch(() => undefined)
      }, 1600)
    },
    [refreshSessions],
  )

  const maybeRefreshTitle = useCallback(
    (items: ChatSessionItem[]) => {
      const current = sessionIdRef.current
      if (current == null) {
        return
      }
      const row = items.find((item) => item.id === current)
      if (!row || !row.title.trim()) {
        scheduleTitleRefresh(current)
      }
    },
    [scheduleTitleRefresh],
  )

  useEffect(() => {
    let cancelled = false
    setSessionsLoading(true)
    void refreshSessions()
      .catch((err: unknown) => {
        if (cancelled || rejectUnauthorized(err)) {
          return
        }
        setSessionsError(err instanceof Error ? err.message : '会话列表加载失败')
      })
      .finally(() => {
        if (!cancelled) {
          setSessionsLoading(false)
        }
      })
    return () => {
      cancelled = true
      if (titleTimerRef.current != null) {
        window.clearTimeout(titleTimerRef.current)
      }
    }
  }, [refreshSessions, rejectUnauthorized])

  const settleStopped = useCallback((agentId: string) => {
    setMessages((prev) =>
      prev.flatMap((item) => {
        if (item.id !== agentId) {
          return [item]
        }
        if (item.status !== 'streaming' && item.status !== 'sending') {
          return [item]
        }
        if (!item.content) {
          return []
        }
        return [{ ...item, status: 'done' as const, createdAt: Date.now(), error: undefined }]
      }),
    )
  }, [])

  const abortTurn = useCallback(() => {
    const agentId = activeAgentRef.current
    abortStream()
    completeAbortRef.current?.abort()
    if (agentId) {
      settleStopped(agentId)
    }
    activeAgentRef.current = null
    finish()
  }, [abortStream, finish, settleStopped])

  const deliver = useCallback(
    async (agentId: string, text: string, replyMode: ReplyMode) => {
      const epoch = epochRef.current
      busyRef.current = true
      activeAgentRef.current = agentId
      setBusy(true)
      const alive = () => epochRef.current === epoch

      if (replyMode === 'stream') {
        patch(agentId, { content: '', status: 'streaming', error: undefined })
        await start(requestBody(text), {
          onSession(id) {
            if (!alive()) {
              return
            }
            rememberSession(id)
          },
          onDelta(chunk) {
            if (!alive()) {
              return
            }
            setMessages((prev) =>
              prev.map((item) =>
                item.id === agentId ? { ...item, content: item.content + chunk } : item,
              ),
            )
          },
          onDone() {
            if (!alive()) {
              return
            }
            patch(agentId, { status: 'done', createdAt: Date.now(), error: undefined })
            if (activeAgentRef.current === agentId) {
              activeAgentRef.current = null
              finish()
            }
            void refreshSessions()
              .then((items) => maybeRefreshTitle(items))
              .catch(() => undefined)
          },
          onError(err) {
            if (!alive()) {
              return
            }
            const current = activeAgentRef.current === agentId
            if (current) {
              activeAgentRef.current = null
              finish()
            }
            if (!current || rejectUnauthorized(err)) {
              return
            }
            patch(agentId, { status: 'error', error: err.message })
          },
        })
        return
      }

      patch(agentId, { content: '', status: 'sending', error: undefined })
      const controller = new AbortController()
      completeAbortRef.current = controller
      try {
        const reply = await sendChat(requestBody(text), controller.signal)
        if (!alive() || controller.signal.aborted) {
          return
        }
        if (typeof reply?.session_id === 'number') {
          rememberSession(reply.session_id)
        }
        if (!reply?.answer) {
          throw new ApiError(0, '回复为空')
        }
        patch(agentId, {
          content: reply.answer,
          status: 'done',
          createdAt: Date.now(),
          error: undefined,
        })
        void refreshSessions()
          .then((items) => maybeRefreshTitle(items))
          .catch(() => undefined)
      } catch (err) {
        if (!alive() || controller.signal.aborted || isAbort(err)) {
          return
        }
        if (!rejectUnauthorized(err)) {
          const detail = err instanceof Error ? err.message : '发送失败'
          patch(agentId, { status: 'error', error: detail })
        }
      } finally {
        if (completeAbortRef.current === controller) {
          completeAbortRef.current = null
        }
        if (alive() && activeAgentRef.current === agentId) {
          activeAgentRef.current = null
          finish()
        }
      }
    },
    [finish, maybeRefreshTitle, patch, rememberSession, refreshSessions, rejectUnauthorized, requestBody, start],
  )

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busyRef.current || restoringRef.current) {
        return
      }
      const agentId = createId()
      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: trimmed,
        status: 'done',
        createdAt: Date.now(),
      }
      const agentMessage: ChatMessage = {
        id: agentId,
        role: 'agent',
        content: '',
        status: mode === 'stream' ? 'streaming' : 'sending',
        createdAt: Date.now(),
      }
      setMessages((prev) => [...prev, userMessage, agentMessage])
      void deliver(agentId, trimmed, mode)
    },
    [deliver, mode],
  )

  const retry = useCallback(
    (agentId: string) => {
      if (busyRef.current) {
        return
      }
      const text = userTextFor(messages, agentId)
      if (!text) {
        return
      }
      void deliver(agentId, text, mode)
    },
    [deliver, messages, mode],
  )

  const beginNewSession = useCallback(() => {
    epochRef.current += 1
    abortTurn()
    sessionIdRef.current = null
    setSessionId(null)
    setMessages([])
    setNotice('')
    restoringRef.current = false
    setRestoring(false)
    setFocusSignal((value) => value + 1)
  }, [abortTurn])

  const openSession = useCallback(
    async (id: number) => {
      if (id === sessionIdRef.current && !busyRef.current) {
        return
      }
      epochRef.current += 1
      const epoch = epochRef.current
      abortTurn()
      sessionIdRef.current = id
      setSessionId(id)
      setNotice('')
      setMessages([])
      restoringRef.current = true
      setRestoring(true)
      try {
        const page = await listSessionMessages(id)
        if (epochRef.current !== epoch) {
          return
        }
        const items = Array.isArray(page.items) ? page.items : []
        setMessages([...items].reverse().map(toChatMessage))
      } catch (err) {
        if (epochRef.current !== epoch || rejectUnauthorized(err)) {
          return
        }
        if (isNotFound(err)) {
          setNotice('会话不存在或无权查看')
          sessionIdRef.current = null
          setSessionId(null)
          setMessages([])
          void refreshSessions().catch(() => undefined)
          return
        }
        setNotice(err instanceof Error ? err.message : '历史加载失败')
      } finally {
        if (epochRef.current === epoch) {
          restoringRef.current = false
          setRestoring(false)
        }
      }
    },
    [abortTurn, refreshSessions, rejectUnauthorized],
  )

  const loadMoreSessions = useCallback(async () => {
    const next = pageRef.current + 1
    const page = await listSessions(next, SESSION_PAGE_SIZE)
    pageRef.current = next
    const items = Array.isArray(page.items) ? page.items : []
    applySessionPage(items, page.total ?? items.length, false)
  }, [applySessionPage])

  const rename = useCallback(
    async (id: number, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) {
        return
      }
      const saved = await renameSession(id, trimmed)
      setSessions((prev) => prev.map((item) => (item.id === id ? { ...item, title: saved.title } : item)))
    },
    [],
  )

  const remove = useCallback(
    async (id: number) => {
      await deleteSession(id)
      setSessions((prev) => prev.filter((item) => item.id !== id))
      setSessionsTotal((total) => Math.max(0, total - 1))
      if (sessionIdRef.current === id) {
        beginNewSession()
      }
    },
    [beginNewSession],
  )

  const setReplyMode = useCallback((next: ReplyMode) => {
    setMode(next)
  }, [])

  return {
    messages,
    mode,
    setMode: setReplyMode,
    busy,
    restoring,
    send,
    retry,
    abort: abortTurn,
    sessionId,
    sessions,
    sessionsTotal,
    sessionsLoading,
    sessionsError,
    notice,
    focusSignal,
    beginNewSession,
    openSession,
    loadMoreSessions,
    renameSession: rename,
    deleteSession: remove,
  }
}

function mergeSessions(prev: ChatSessionItem[], incoming: ChatSessionItem[]) {
  const seen = new Set(prev.map((item) => item.id))
  return [...prev, ...incoming.filter((item) => !seen.has(item.id))]
}
