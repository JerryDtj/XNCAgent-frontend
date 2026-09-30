import { useCallback, useEffect, useRef } from 'react'
import { openStream } from '../api/client'
import { CHAT_API } from '../config/api'
import type { ChatRequestBody } from '../types/chat'

type StreamHandlers = {
  onDelta: (text: string) => void
  onDone: () => void
  onError: (err: Error) => void
  onSession?: (sessionId: number) => void
}

function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError'
}

function frameData(frame: string) {
  const lines = frame.split('\n').filter((line) => line.startsWith('data:'))
  if (lines.length === 0) {
    return null
  }
  return lines.map((line) => line.slice(5).trimStart()).join('\n')
}

function applyFrame(frame: string, handlers: Pick<StreamHandlers, 'onDelta' | 'onSession'>) {
  const data = frameData(frame)
  if (data == null) {
    return false
  }
  if (data === '[DONE]') {
    return true
  }
  let payload: unknown
  try {
    payload = JSON.parse(data)
  } catch {
    return false
  }
  if (!payload || typeof payload !== 'object') {
    return false
  }
  const record = payload as { text?: unknown; error?: unknown; session_id?: unknown }
  if (typeof record.session_id === 'number' && Number.isInteger(record.session_id) && record.session_id > 0) {
    handlers.onSession?.(record.session_id)
  }
  if (typeof record.error === 'string' && record.error) {
    throw new Error(record.error)
  }
  if (typeof record.text === 'string' && record.text) {
    handlers.onDelta(record.text)
  }
  return false
}

export function useStreamingChat() {
  const abortRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  useEffect(() => abort, [abort])

  const start = useCallback(
    async (body: ChatRequestBody, handlers: StreamHandlers) => {
      abort()
      const controller = new AbortController()
      abortRef.current = controller
      let buffer = ''
      let finished = false

      const consume = (flush: boolean) => {
        const parts = buffer.replace(/\r\n/g, '\n').split('\n\n')
        buffer = flush ? '' : (parts.pop() ?? '')
        for (const part of parts) {
          if (!part.trim() || finished) {
            continue
          }
          if (applyFrame(part, handlers)) {
            finished = true
          }
        }
      }

      try {
        const res = await openStream(CHAT_API.stream, {
          method: 'POST',
          body: JSON.stringify(body),
          signal: controller.signal,
          cache: 'no-store',
          headers: { Accept: 'text/event-stream' },
        })
        if (!res.body) {
          throw new Error('响应没有内容')
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        while (!finished) {
          const { done, value } = await reader.read()
          if (done) {
            buffer += decoder.decode()
            consume(true)
            break
          }
          buffer += decoder.decode(value, { stream: true })
          consume(false)
        }
        if (!controller.signal.aborted) {
          handlers.onDone()
        }
      } catch (err) {
        if (controller.signal.aborted || isAbort(err)) {
          return
        }
        handlers.onError(err instanceof Error ? err : new Error('流式请求失败'))
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    [abort],
  )

  return { start, abort }
}
