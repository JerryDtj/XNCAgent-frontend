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

export async function readChatStream(body: ChatRequestBody, signal: AbortSignal, handlers: StreamHandlers) {
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

  const res = await openStream(CHAT_API.stream, {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
    cache: 'no-store',
    headers: { Accept: 'text/event-stream' },
  })
  if (!res.body) {
    throw new Error('响应没有内容')
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  try {
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
  } catch (err) {
    if (signal.aborted || isAbort(err)) {
      return
    }
    throw err
  }
  if (!signal.aborted) {
    handlers.onDone()
  }
}
