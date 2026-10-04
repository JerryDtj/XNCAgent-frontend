import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { me } from '../api/auth'
import { deleteSession, listMessagesAround, listSessionMessages, listSessions, renameSession } from '../api/sessions'
import { clearAccessToken, goToLogin } from '../auth'
import { readLastSession, saveLastSession } from '../chat/lastSession'
import { forgetTurn, lookupTurn, startLiveTurn, stopAllLiveTurns, stopLiveTurn, subscribeLiveTurns } from '../chat/liveTurns'
import { clearMusicSession, musicSessionKey } from '../chat/musicStore'
import { SESSION_PAGE_SIZE } from '../config/api'
import type { ChatMessage, ChatSessionItem, HistoryMessage, ReplyMode } from '../types/chat'
import { createId } from '../utils/createId'
import { parseServerTime } from '../utils/serverTime'

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

function toChatMessage(item: HistoryMessage): ChatMessage {
  const createdAt = parseServerTime(item.created_at)
  return {
    id: String(item.id),
    role: item.role === 'user' ? 'user' : 'agent',
    content: item.content ?? '',
    status: 'done',
    createdAt: createdAt ?? Date.now(),
    interrupted: item.interrupted === true,
  }
}

function serverHasLiveTail(serverMessages: ChatMessage[], liveMessages: ChatMessage[]) {
  const tail = [...liveMessages].reverse().find((item) => item.role === 'agent' && item.content)
  if (!tail) {
    return serverMessages.length >= liveMessages.length
  }
  return serverMessages.some((item) => item.role === 'agent' && item.content === tail.content)
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
  const [loaded, setLoaded] = useState<ChatMessage[]>([])
  const [mode, setMode] = useState<ReplyMode>('stream')
  const [restoring, setRestoring] = useState(false)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [draftToken, setDraftToken] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSessionItem[]>([])
  const [sessionsTotal, setSessionsTotal] = useState(0)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState('')
  const [notice, setNotice] = useState('')
  const [focusSignal, setFocusSignal] = useState(0)
  const [locateMessageId, setLocateMessageId] = useState<string | null>(null)
  const [anchored, setAnchored] = useState(false)
  const [hasEarlier, setHasEarlier] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [, setLiveRev] = useState(0)
  const sessionIdRef = useRef<number | null>(null)
  const draftTokenRef = useRef<string | null>(null)
  const loadedRef = useRef<ChatMessage[]>([])
  const restoringRef = useRef(false)
  const epochRef = useRef(0)
  const pageRef = useRef(1)
  const titleTimerRef = useRef<number | null>(null)
  const userIdRef = useRef<number | null>(null)
  const pendingLastRef = useRef<number | null | undefined>(undefined)
  const skipRestoreRef = useRef(false)
  const openSessionRef = useRef<
    (id: number, messageId?: number | null, quietMissing?: boolean) => Promise<void>
  >(async () => undefined)
  loadedRef.current = loaded

  function touchLast(sessionId: number | null) {
    const userId = userIdRef.current
    if (userId == null) {
      pendingLastRef.current = sessionId
      return
    }
    saveLastSession(userId, sessionId)
  }

  useEffect(() => subscribeLiveTurns(() => setLiveRev((value) => value + 1)), [])

  const live = lookupTurn(sessionId, draftToken)
  const messages = live?.messages ?? loaded
  const busy = live?.running === true

  const rememberSession = useCallback((id: number) => {
    sessionIdRef.current = id
    setSessionId(id)
    touchLast(id)
    setSessions((prev) => (prev.some((item) => item.id === id) ? prev : [stubSession(id), ...prev]))
  }, [])

  const rejectUnauthorized = useCallback((err: unknown) => {
    if (!(err instanceof ApiError) || (err.code !== 401 && err.code !== 40101)) {
      return false
    }
    clearAccessToken()
    goToLogin()
    return true
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
    void (async () => {
      try {
        await refreshSessions()
        if (cancelled) {
          return
        }
        const profile = await me()
        if (cancelled) {
          return
        }
        userIdRef.current = profile.user_id
        if (pendingLastRef.current !== undefined) {
          const overridden = pendingLastRef.current
          pendingLastRef.current = undefined
          saveLastSession(profile.user_id, overridden)
          if (overridden == null) {
            return
          }
        }
        if (skipRestoreRef.current) {
          return
        }
        const last = readLastSession()
        if (!last || last.userId !== profile.user_id || last.sessionId == null) {
          return
        }
        await openSessionRef.current(last.sessionId, null, true)
      } catch (err: unknown) {
        if (cancelled || rejectUnauthorized(err)) {
          return
        }
        setSessionsError(err instanceof Error ? err.message : '会话列表加载失败')
      } finally {
        if (!cancelled) {
          setSessionsLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
      if (titleTimerRef.current != null) {
        window.clearTimeout(titleTimerRef.current)
      }
    }
  }, [refreshSessions, rejectUnauthorized])

  const noteSession = useCallback(
    (id: number, token: string) => {
      if (sessionIdRef.current == null && draftTokenRef.current === token) {
        draftTokenRef.current = null
        setDraftToken(null)
        rememberSession(id)
      }
      void refreshSessions()
        .then((items) => maybeRefreshTitle(items))
        .catch((err: unknown) => {
          rejectUnauthorized(err)
        })
    },
    [maybeRefreshTitle, refreshSessions, rejectUnauthorized, rememberSession],
  )

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      const sid = sessionIdRef.current
      const token = sid == null ? (draftTokenRef.current ?? createId()) : null
      if (lookupTurn(sid, token)?.running || restoringRef.current || !trimmed) {
        return
      }
      if (sid == null && token !== draftTokenRef.current) {
        draftTokenRef.current = token
        setDraftToken(token)
      }
      const seed = lookupTurn(sid, token)?.messages ?? loadedRef.current
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
      startLiveTurn({
        sessionId: sid,
        draftToken: token,
        messages: [...seed, userMessage, agentMessage],
        agentId,
        text: trimmed,
        mode,
        onSession: (id) => noteSession(id, token ?? ''),
        onError: rejectUnauthorized,
      })
    },
    [mode, noteSession, rejectUnauthorized],
  )

  const retry = useCallback(
    (agentId: string) => {
      const sid = sessionIdRef.current
      const token = draftTokenRef.current
      if (lookupTurn(sid, token)?.running) {
        return
      }
      const seed = lookupTurn(sid, token)?.messages ?? loadedRef.current
      const text = userTextFor(seed, agentId)
      if (!text) {
        return
      }
      const next = seed.map((item) =>
        item.id === agentId
          ? {
              ...item,
              content: '',
              status: mode === 'stream' ? ('streaming' as const) : ('sending' as const),
              error: undefined,
              interrupted: false,
            }
          : item,
      )
      startLiveTurn({
        sessionId: sid,
        draftToken: sid == null ? token : null,
        messages: next,
        agentId,
        text,
        mode,
        onSession: (id) => noteSession(id, token ?? ''),
        onError: rejectUnauthorized,
      })
    },
    [mode, noteSession, rejectUnauthorized],
  )

  const beginNewSession = useCallback(() => {
    epochRef.current += 1
    skipRestoreRef.current = true
    const token = createId()
    draftTokenRef.current = token
    setDraftToken(token)
    sessionIdRef.current = null
    setSessionId(null)
    touchLast(null)
    setLoaded([])
    setNotice('')
    setLocateMessageId(null)
    setAnchored(false)
    setHasEarlier(false)
    restoringRef.current = false
    setRestoring(false)
    setFocusSignal((value) => value + 1)
  }, [])

  const openSession = useCallback(
    async (id: number, messageId?: number | null, quietMissing = false) => {
      const locateId = messageId != null ? String(messageId) : null
      if (messageId == null && id === sessionIdRef.current && !restoringRef.current) {
        return
      }
      epochRef.current += 1
      const epoch = epochRef.current
      draftTokenRef.current = null
      setDraftToken(null)
      sessionIdRef.current = id
      setSessionId(id)
      touchLast(id)
      setNotice('')
      const existing = lookupTurn(id, null)
      if (existing?.running && messageId == null) {
        setLocateMessageId(null)
        setAnchored(false)
        setHasEarlier(false)
        restoringRef.current = false
        setRestoring(false)
        return
      }
      if (!existing) {
        setLoaded([])
      }
      restoringRef.current = true
      setRestoring(true)
      try {
        const page = messageId != null
          ? await listMessagesAround(id, messageId)
          : await listSessionMessages(id)
        if (epochRef.current !== epoch) {
          return
        }
        const still = lookupTurn(id, null)
        if (still?.running && messageId == null) {
          return
        }
        const items = Array.isArray(page.items) ? page.items : []
        const ordered = messageId != null ? items : [...items].reverse()
        const serverMessages = ordered.map(toChatMessage)
        if (still && !still.running && messageId == null && !serverHasLiveTail(serverMessages, still.messages)) {
          setLocateMessageId(locateId)
          setAnchored(false)
          setHasEarlier(false)
          return
        }
        setLoaded(serverMessages)
        if (still && !still.running) {
          forgetTurn(id)
        }
        setLocateMessageId(locateId)
        setAnchored(messageId != null)
        setHasEarlier(messageId != null && items.filter((item) => item.id < messageId).length >= 2)
      } catch (err) {
        if (epochRef.current !== epoch || rejectUnauthorized(err)) {
          return
        }
        if (isNotFound(err)) {
          setLocateMessageId(null)
          setAnchored(false)
          setHasEarlier(false)
          sessionIdRef.current = null
          setSessionId(null)
          setLoaded([])
          touchLast(null)
          if (!quietMissing) {
            setNotice('会话不存在或无权查看')
            void refreshSessions().catch(() => undefined)
          }
          return
        }
        setLocateMessageId(null)
        setAnchored(false)
        setHasEarlier(false)
        setNotice(err instanceof Error ? err.message : '历史加载失败')
      } finally {
        if (epochRef.current === epoch) {
          restoringRef.current = false
          setRestoring(false)
        }
      }
    },
    [refreshSessions, rejectUnauthorized],
  )
  openSessionRef.current = openSession

  const loadEarlier = useCallback(async () => {
    const sessionId = sessionIdRef.current
    if (sessionId == null || loadingEarlier) {
      return
    }
    const ids = messages.map((item) => Number(item.id)).filter((id) => Number.isInteger(id))
    if (ids.length === 0) {
      setHasEarlier(false)
      return
    }
    const minId = Math.min(...ids)
    setLoadingEarlier(true)
    try {
      const page = await listMessagesAround(sessionId, minId, 2, 0)
      const older = (page.items ?? []).filter((item) => item.id < minId)
      if (older.length === 0) {
        setHasEarlier(false)
        return
      }
      setLoaded((prev) => [...older.map(toChatMessage), ...prev])
      setHasEarlier(older.length >= 2)
    } finally {
      setLoadingEarlier(false)
    }
  }, [loadingEarlier, messages])

  const jumpLatest = useCallback(async () => {
    const sessionId = sessionIdRef.current
    if (sessionId == null) {
      return
    }
    epochRef.current += 1
    const epoch = epochRef.current
    setNotice('')
    setLocateMessageId(null)
    restoringRef.current = true
    setRestoring(true)
    try {
      const page = await listSessionMessages(sessionId)
      if (epochRef.current !== epoch) {
        return
      }
      const items = Array.isArray(page.items) ? page.items : []
      setLoaded([...items].reverse().map(toChatMessage))
      const finished = lookupTurn(sessionId, null)
      if (finished && !finished.running) {
        forgetTurn(sessionId)
      }
      setAnchored(false)
      setHasEarlier(false)
    } catch (err) {
      if (epochRef.current !== epoch || rejectUnauthorized(err)) {
        return
      }
      setNotice(err instanceof Error ? err.message : '历史加载失败')
    } finally {
      if (epochRef.current === epoch) {
        restoringRef.current = false
        setRestoring(false)
      }
    }
  }, [rejectUnauthorized])

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
      stopLiveTurn(id, null)
      await deleteSession(id)
      forgetTurn(id)
      const key = musicSessionKey(id, null)
      if (key) {
        clearMusicSession(key)
      }
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
    stop: () => stopLiveTurn(sessionIdRef.current, draftTokenRef.current),
    stopAll: stopAllLiveTurns,
    sessionId,
    draftToken,
    sessions,
    sessionsTotal,
    sessionsLoading,
    sessionsError,
    notice,
    focusSignal,
    locateMessageId,
    setLocateMessageId,
    anchored,
    hasEarlier,
    loadingEarlier,
    loadEarlier,
    jumpLatest,
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
