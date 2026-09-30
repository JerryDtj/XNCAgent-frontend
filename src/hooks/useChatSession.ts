import { useCallback, useRef, useState } from 'react'
import { sendChat } from '../api/chat'
import { ApiError } from '../api/client'
import { clearAccessToken, goToLogin } from '../auth'
import type { ChatMessage, ChatRequestBody, ReplyMode } from '../types/chat'
import { createId } from '../utils/createId'
import { useStreamingChat } from './useStreamingChat'

function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError'
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

export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [mode, setMode] = useState<ReplyMode>('stream')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const activeAgentRef = useRef<string | null>(null)
  const completeAbortRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef<number | null>(null)
  const { start, abort: abortStream } = useStreamingChat()

  const rememberSession = useCallback((sessionId: number) => {
    sessionIdRef.current = sessionId
  }, [])

  const requestBody = useCallback((message: string): ChatRequestBody => {
    const sessionId = sessionIdRef.current
    return sessionId == null ? { message } : { message, session_id: sessionId }
  }, [])

  const rejectUnauthorized = useCallback(
    (err: unknown) => {
      if (!(err instanceof ApiError) || (err.code !== 401 && err.code !== 40101)) {
        return false
      }
      clearAccessToken()
      goToLogin()
      return true
    },
    [],
  )

  const patch = useCallback((id: string, next: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((item) => (item.id === id ? { ...item, ...next } : item)))
  }, [])

  const finish = useCallback(() => {
    busyRef.current = false
    setBusy(false)
  }, [])

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

  const deliver = useCallback(
    async (agentId: string, text: string, replyMode: ReplyMode) => {
      busyRef.current = true
      activeAgentRef.current = agentId
      setBusy(true)
      if (replyMode === 'stream') {
        patch(agentId, { content: '', status: 'streaming', error: undefined })
        await start(requestBody(text), {
          onSession: rememberSession,
          onDelta(chunk) {
            setMessages((prev) =>
              prev.map((item) =>
                item.id === agentId ? { ...item, content: item.content + chunk } : item,
              ),
            )
          },
          onDone() {
            patch(agentId, { status: 'done', createdAt: Date.now(), error: undefined })
            if (activeAgentRef.current === agentId) {
              activeAgentRef.current = null
              finish()
            }
          },
          onError(err) {
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
        if (typeof reply?.session_id === 'number') {
          rememberSession(reply.session_id)
        }
        if (controller.signal.aborted) {
          return
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
      } catch (err) {
        if (controller.signal.aborted || isAbort(err)) {
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
        if (activeAgentRef.current === agentId) {
          activeAgentRef.current = null
          finish()
        }
      }
    },
    [finish, patch, rememberSession, rejectUnauthorized, requestBody, start],
  )

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busyRef.current) {
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

  const setReplyMode = useCallback((next: ReplyMode) => {
    setMode(next)
  }, [])

  const abort = useCallback(() => {
    const agentId = activeAgentRef.current
    abortStream()
    completeAbortRef.current?.abort()
    if (agentId) {
      settleStopped(agentId)
    }
    activeAgentRef.current = null
    finish()
  }, [abortStream, finish, settleStopped])

  return { messages, mode, setMode: setReplyMode, busy, send, retry, abort }
}
