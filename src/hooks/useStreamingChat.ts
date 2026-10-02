import { openStream } from '../api/client'
import { CHAT_API } from '../config/api'
import type { ChatRequestBody, MusicInfo } from '../types/chat'

type StreamHandlers = {
  onDelta: (text: string) => void
  onDone: () => void
  onError: (err: Error) => void
  onSession?: (sessionId: number) => void
  onMeta?: (music: MusicInfo) => void
}

function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError'
}

function parseFrame(frame: string): { event: string; data: string | null } {
  let event = 'message'
  const dataLines: string[] = []
  for (const raw of frame.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() || 'message'
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }
  if (dataLines.length === 0) {
    return { event, data: null }
  }
  return { event, data: dataLines.join('\n') }
}

function parseMusic(payload: unknown): MusicInfo | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const music = (payload as { music?: unknown }).music
  if (!music || typeof music !== 'object') {
    return null
  }
  const record = music as Record<string, unknown>
  if (
    typeof record.title !== 'string' ||
    typeof record.url !== 'string' ||
    typeof record.scene !== 'string' ||
    typeof record.reason !== 'string'
  ) {
    return null
  }
  return {
    title: record.title,
    url: record.url,
    scene: record.scene,
    reason: record.reason,
    notice: typeof record.notice === 'string' ? record.notice : undefined,
  }
}

function applyFrame(frame: string, handlers: Pick<StreamHandlers, 'onDelta' | 'onSession' | 'onMeta'>) {
  const { event, data } = parseFrame(frame)
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

  if (event === 'meta') {
    const music = parseMusic(payload)
    if (music) {
      handlers.onMeta?.(music)
    }
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
